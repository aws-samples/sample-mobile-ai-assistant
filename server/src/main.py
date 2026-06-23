import base64
from typing import List
import uvicorn
from fastapi import FastAPI, HTTPException, Request as FastAPIRequest
from fastapi.responses import StreamingResponse, PlainTextResponse
import boto3
import json
import random
import os
import re
from pydantic import BaseModel
import time
from image_nl_processor import get_native_request_with_ref_image, get_analyse_result, get_native_request_with_virtual_try_on
import httpx
from mantle import get_mantle_base_url, sign_mantle_request

app = FastAPI()

CACHE_DURATION = 120000
cache = {
    "latest_version": "",
    "last_check": 0
}


class ImageRequest(BaseModel):
    prompt: str
    refImages: List[dict] | None = None
    modelId: str
    region: str
    width: int
    height: int


class ConverseRequest(BaseModel):
    messages: List[dict] = []
    modelId: str
    enableThinking: bool | None = None
    region: str
    system: List[dict] | None = None


class StreamOptions(BaseModel):
    include_usage: bool = True


class GPTRequest(BaseModel):
    model: str
    messages: List[dict]
    stream: bool = True
    stream_options: StreamOptions


class ModelsRequest(BaseModel):
    region: str


# bedrock-mantle requests are proxied verbatim: the client builds the OpenAI
# Responses / Anthropic Messages body, we sign it with the server IAM role and
# stream the response straight back.
class MantleRequest(BaseModel):
    region: str
    body: dict


class TokenRequest(BaseModel):
    region: str


class UpgradeRequest(BaseModel):
    os: str
    version: str


# Claude requires max_tokens on Converse; omitting it truncates at 4096.
# Other families default to their server-side max, so None leaves them alone.
def _resolve_max_tokens(model_id: str) -> int | None:
    mid = model_id.lower()
    if "anthropic" in mid or "claude" in mid:
        if "claude-opus-4-7" in mid or "claude-opus-4-6" in mid:
            return 128000
        if (
            "claude-opus-4-5" in mid
            or "claude-sonnet-4" in mid
            or "claude-3-7-sonnet" in mid
            or "claude-haiku-4-5" in mid
        ):
            return 64000
        if "claude-opus-4" in mid:
            return 32000
        if "claude-3-5" in mid:
            return 8192
        return 4096
    if "nova-premier" in mid:
        return 25000
    return None


# Sonnet >= 4 and Opus >= 4.5 accept the 1M input-context beta.
def _supports_1m_context(model_id: str) -> bool:
    mid = model_id.lower()
    if "claude-sonnet-4" in mid:
        return True
    return any(
        v in mid
        for v in ("claude-opus-4-5", "claude-opus-4-6", "claude-opus-4-7")
    )


async def create_bedrock_command(request: ConverseRequest) -> tuple[boto3.client, dict]:
    model_id = request.modelId
    region = request.region

    client = boto3.client("bedrock-runtime", region_name=region)

    for message in request.messages:
        if message["role"] == "user":
            for content in message["content"]:
                if 'image' in content:
                    image_bytes = base64.b64decode(content['image']['source']['bytes'])
                    content['image']['source']['bytes'] = image_bytes
                if 'video' in content:
                    video_bytes = base64.b64decode(content['video']['source']['bytes'])
                    content['video']['source']['bytes'] = video_bytes
                if 'document' in content:
                    document_bytes = base64.b64decode(content['document']['source']['bytes'])
                    content['document']['source']['bytes'] = document_bytes

    command = {
        "messages": request.messages,
        "modelId": model_id
    }

    max_tokens = _resolve_max_tokens(model_id)
    if max_tokens is not None:
        command["inferenceConfig"] = {"maxTokens": max_tokens}

    extra: dict = {}
    if request.enableThinking:
        extra["reasoning_config"] = {"type": "enabled", "budget_tokens": 16000}
    if _supports_1m_context(model_id):
        extra["anthropic_beta"] = ["context-1m-2025-08-07"]
    if extra:
        command["additionalModelRequestFields"] = extra

    if request.system is not None:
        command["system"] = request.system

    return client, command


@app.post("/api/converse/v3")
async def converse_v3(request: ConverseRequest):
    try:
        client, command = await create_bedrock_command(request)

        def event_generator():
            try:
                response = client.converse_stream(**command)
                for item in response['stream']:
                    yield json.dumps(item) + '\n\n'
            except Exception as err:
                yield f"Error: {str(err)}"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    except Exception as error:
        return PlainTextResponse(f"Error: {str(error)}", status_code=500)


@app.post("/api/converse/v2")
async def converse_v2(request: ConverseRequest):
    try:
        client, command = await create_bedrock_command(request)

        def event_generator():
            try:
                response = client.converse_stream(**command)
                for item in response['stream']:
                    yield json.dumps(item)
            except Exception as err:
                yield f"Error: {str(err)}"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    except Exception as error:
        return PlainTextResponse(f"Error: {str(error)}", status_code=500)


@app.post("/api/image")
async def gen_image(request: ImageRequest):
    model_id = request.modelId
    prompt = request.prompt
    ref_images = request.refImages
    width = request.width
    height = request.height
    region = request.region
    client = boto3.client("bedrock-runtime",
                          region_name=region)
    if (ref_images is None or model_id.startswith("stability.")) and contains_chinese(prompt):
        prompt = get_english_prompt(client, prompt)
    return get_image(client, model_id, prompt, ref_images, width, height)


@app.post("/api/token")
async def get_token(request: TokenRequest):
    region = request.region
    try:
        client_role_arn = os.environ.get('CLIENT_ROLE_ARN')
        if not client_role_arn:
            return {"error": "CLIENT_ROLE_ARN environment variable not set"}
        sts_client = boto3.client('sts', region_name=region)
        session_name = f"SwiftChatClient-{int(time.time())}"
        response = sts_client.assume_role(
            RoleArn=client_role_arn,
            RoleSessionName=session_name,
            DurationSeconds=3600
        )
        credentials = response['Credentials']
        return {
            "accessKeyId": credentials['AccessKeyId'],
            "secretAccessKey": credentials['SecretAccessKey'],
            "sessionToken": credentials['SessionToken'],
            "expiration": credentials['Expiration'].isoformat()
        }
    except Exception as e:
        print(f"Error assuming role: {e}")
        return {"error": str(e)}


@app.post("/api/models")
async def get_models(request: ModelsRequest):
    region = request.region
    client = boto3.client("bedrock",
                          region_name=region)

    try:
        response = client.list_foundation_models()
        if response.get("modelSummaries"):
            model_names = set()
            text_model = []
            image_model = []
            for model in response["modelSummaries"]:
                need_cross_region = "INFERENCE_PROFILE" in model["inferenceTypesSupported"]
                if ((model["modelLifecycle"]["status"] == "ACTIVE"
                     or model["modelId"] == "amazon.nova-canvas-v1:0")
                        and ("ON_DEMAND" in model["inferenceTypesSupported"] or need_cross_region)
                        and not model["modelId"].endswith("k")
                        and model["modelName"] not in model_names):
                    if ("TEXT" in model.get("outputModalities", []) and
                            model.get("responseStreamingSupported")):
                        if need_cross_region:
                            region_prefix = region.split("-")[0]
                            if region_prefix == 'ap':
                                region_prefix = 'apac'
                            model_id = region_prefix + "." + model["modelId"]
                        else:
                            model_id = model["modelId"]
                        text_model.append({
                            "modelId": model_id,
                            "modelName": model["modelName"]
                        })
                    elif "IMAGE" in model.get("outputModalities", []):
                        image_model.append({
                            "modelId": model["modelId"],
                            "modelName": model["modelName"]
                        })
                    model_names.add(model["modelName"])
            return {"textModel": text_model, "imageModel": image_model}
        else:
            return []
    except Exception as e:
        print(f"bedrock error: {e}")
        return {"error": str(e)}


@app.post("/api/mantle/models")
async def mantle_models(request: ModelsRequest):
    region = request.region
    url = get_mantle_base_url(region) + "/v1/models"
    headers = sign_mantle_request("GET", url, region)
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=8)
            return response.json()
    except Exception as e:
        print(f"mantle models error: {e}")
        return {"error": str(e)}


@app.post("/api/mantle/responses")
async def mantle_responses(request: MantleRequest):
    return await _mantle_stream(request, "/openai/v1/responses")


@app.post("/api/mantle/chat")
async def mantle_chat(request: MantleRequest):
    return await _mantle_stream(request, "/openai/v1/chat/completions")


@app.post("/api/mantle/messages")
async def mantle_messages(request: MantleRequest):
    return await _mantle_stream(
        request,
        "/anthropic/v1/messages",
        extra_headers={"anthropic-version": "2023-06-01"},
    )


async def _mantle_stream(request: MantleRequest, path: str, extra_headers: dict | None = None):
    region = request.region
    url = get_mantle_base_url(region) + path
    body = json.dumps(request.body)
    headers = sign_mantle_request("POST", url, region, body=body, extra_headers=extra_headers)
    headers["Accept"] = "text/event-stream"

    async def event_generator():
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream(
                    "POST", url, content=body, headers=headers, timeout=None
                ) as response:
                    async for chunk in response.aiter_bytes():
                        if chunk:
                            yield chunk
            except Exception as err:
                print("mantle stream error:", err)
                yield f"Error: {str(err)}".encode("utf-8")

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/upgrade")
async def upgrade(request: UpgradeRequest):
    new_version = get_latest_version()
    total_number = calculate_version_total(request.version)
    need_upgrade = False
    url = ''
    if total_number > 0:
        need_upgrade = total_number < calculate_version_total(new_version)
        if need_upgrade:
            download_prefix = "https://github.com/aws-samples/sample-mobile-ai-assistant/releases/download/"
            if request.os == 'android':
                url = download_prefix + new_version + "/AIAssistant.apk"
            elif request.os == 'mac':
                url = download_prefix + new_version + "/AIAssistant.dmg"
    return {"needUpgrade": need_upgrade, "version": new_version, "url": url}


@app.post("/api/openai")
async def converse_openai(request: GPTRequest, raw_request: FastAPIRequest):
    auth_header = raw_request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    openai_api_key = auth_header.split(" ")[1]
    request_url = raw_request.headers.get("request_url")
    if not request_url or not request_url.startswith("http"):
        raise HTTPException(status_code=401, detail="Invalid request url")
    http_referer = raw_request.headers.get("HTTP-Referer")
    x_title = raw_request.headers.get("X-Title")

    async def event_generator():
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream(
                        "POST",
                        request_url,
                        json=request.model_dump(),
                        headers={
                            "Authorization": f"Bearer {openai_api_key}",
                            "Content-Type": "application/json",
                            "Accept": "text/event-stream",
                            **({"HTTP-Referer": http_referer} if http_referer else {}),
                            **({"X-Title": x_title} if x_title else {})
                        }
                ) as response:
                    async for line in response.aiter_bytes():
                        if line:
                            yield line

            except Exception as err:
                print("error:", err)
                yield f"Error: {str(err)}".encode('utf-8')

    return StreamingResponse(event_generator(), media_type="text/event-stream")


def calculate_version_total(version: str) -> int:
    versions = version.split(".")
    total_number = 0
    if len(versions) == 3:
        total_number = int(versions[0]) * 10000 + int(versions[1]) * 100 + int(versions[2])
    return total_number


def get_latest_version() -> str:
    timestamp = int(time.time() * 1000)
    if cache["last_check"] > 0 and timestamp - cache["last_check"] < CACHE_DURATION:
        return cache["latest_version"]
    try:
        response = httpx.get(
            "https://api.github.com/repos/aws-samples/sample-mobile-ai-assistant/tags",
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        content = response.json()
        latest_version = content[0]['name']
        cache["latest_version"] = latest_version
        cache["last_check"] = timestamp
        return latest_version
    except Exception as error:
        print(f"Error occurred when get github tag: {error}")
    return '0.0.0'


def get_image(client, model_id, prompt, ref_image, width, height):
    try:
        seed = random.randint(0, 2147483647)  # nosec B311
        native_request = {}
        if model_id.startswith("amazon"):
            if ref_image is None:
                native_request = {
                    "taskType": "TEXT_IMAGE",
                    "textToImageParams": {"text": prompt},
                    "imageGenerationConfig": {
                        "numberOfImages": 1,
                        "quality": "standard",
                        "cfgScale": 8.0,
                        "height": height,
                        "width": width,
                        "seed": seed,
                    },
                }
            elif len(ref_image) == 2:
                native_request = get_native_request_with_virtual_try_on(client, prompt, ref_image, width, height)
            else:
                native_request = get_native_request_with_ref_image(client, prompt, ref_image, width, height)
        elif model_id.startswith("stability."):
            native_request = {
                "prompt": prompt,
                "output_format": "jpeg",
                "mode": "text-to-image",
            }
            if ref_image:
                native_request['mode'] = 'image-to-image'
                native_request['image'] = ref_image[0]['source']['bytes']
                native_request['strength'] = 0.5
            else:
                native_request['aspect_ratio'] = "1:1"
        request = json.dumps(native_request)
        response = client.invoke_model(modelId=model_id, body=request)
        model_response = json.loads(response["body"].read())
        base64_image_data = model_response["images"][0]
        return {"image": base64_image_data}
    except Exception as error:
        error_msg = str(error)
        print(f"Error occurred: {error_msg}")
        return {"error": error_msg}


def get_english_prompt(client, prompt):
    global_prompt = f"Translate to English image prompt, output only English translation."
    return get_analyse_result(client, prompt, global_prompt)


def contains_chinese(text):
    pattern = re.compile(r'[\u4e00-\u9fff]')
    match = pattern.search(text)
    return match is not None


if __name__ == "__main__":
    print("Starting webserver...")
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))  # nosec B104
