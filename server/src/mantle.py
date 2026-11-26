"""
Helpers for calling the Amazon Bedrock `bedrock-mantle` endpoint.

Mantle is a separate HTTPS endpoint (not a boto3 service) that serves the
OpenAI Responses / Chat Completions APIs and the Anthropic Messages API for the
newest models (GPT-5.5/5.4, Claude Fable 5, gpt-oss, etc.). boto3 has no client
for it, so we sign requests ourselves with SigV4 against the `bedrock-mantle`
service using the server's IAM credentials, then stream the response back.
"""
import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from fastapi import HTTPException

_MANTLE_ENDPOINTS = {  # Only these trusted, app-supported regions form URLs.
    region: f"https://bedrock-mantle.{region}.api.aws"
    for region in (
        "us-west-2 us-east-1 us-east-2 ap-south-1 ap-south-2 "
        "ap-southeast-1 ap-southeast-2 ap-northeast-1 ap-northeast-2 ap-northeast-3 "
        "ca-central-1 eu-central-1 eu-central-2 eu-west-1 eu-west-2 "
        "eu-west-3 eu-north-1 eu-south-1 eu-south-2 sa-east-1"
    ).split()
}


def get_mantle_base_url(region: str) -> str:
    endpoint = _MANTLE_ENDPOINTS.get(region)
    if endpoint is None:
        raise HTTPException(status_code=422, detail="Unsupported Mantle region")
    return endpoint


def sign_mantle_request(
    method: str,
    url: str,
    region: str,
    body: str = "",
    extra_headers: dict | None = None,
) -> dict:
    """SigV4-sign a request against the bedrock-mantle service and return the
    headers to send. Uses the default boto3 credential chain (IAM role on
    Lambda/ECS), so end users do not need a Bedrock API key in server mode."""
    headers = {"Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    aws_request = AWSRequest(method=method, url=url, data=body, headers=headers)
    credentials = boto3.Session().get_credentials()
    SigV4Auth(credentials, "bedrock-mantle", region).add_auth(aws_request)
    return dict(aws_request.headers)
