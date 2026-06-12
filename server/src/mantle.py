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


def get_mantle_base_url(region: str) -> str:
    return f"https://bedrock-mantle.{region}.api.aws"


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
