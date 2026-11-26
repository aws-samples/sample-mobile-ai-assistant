import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from mantle import get_mantle_base_url


class MantleSecurityTests(unittest.TestCase):
    def test_valid_regions(self):
        for region in ("us-west-2", "eu-west-1", "ap-northeast-1"):
            self.assertEqual(get_mantle_base_url(region), f"https://bedrock-mantle.{region}.api.aws")

    def test_invalid_regions_never_sign_or_send(self):
        regions = (
            "attacker.invalid/", "us-east-1.api.aws@127.0.0.1:8443/",
            "us-east-1?x", "us-east-1#x", "us-east-1\\x", "us-east-1\n", "",
        )
        with patch("main.sign_mantle_request") as sign, patch("main.httpx.AsyncClient") as http:
            with TestClient(app) as client:
                for route in ("models", "responses", "chat", "messages"):
                    for region in regions:
                        with self.subTest(route=route, region=region):
                            body = {"region": region, "body": {"model": "test"}}
                            response = client.post(f"/api/mantle/{route}", json=body)
                            self.assertEqual(response.status_code, 422)
            sign.assert_not_called()
            http.assert_not_called()
