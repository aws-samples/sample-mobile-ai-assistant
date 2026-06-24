## AI Assistant Backend API

The AI Assistant backend API is implemented using Python language and the FastAPI framework. It is packaged as a Docker
image using [aws-lambda-adapter](https://github.com/awslabs/aws-lambda-web-adapter) and deployed to API Gateway with
AWS Lambda for execution, supporting streaming responses for up to 15 minutes.

## API Reference

### API Schema

First, please configure you `API URL` and `API Key` like:

```bash
export API_URL=<API URL>
export API_KEY=<API Key>
```

1. `/api/converse/v3`

   ```bash
   curl -N "${API_URL}/api/converse" \
   --header 'Content-Type: application/json' \
   --header "Authorization: Bearer ${API_KEY}" \
   --data '{
     "messages": [
       {
         "role": "user",
         "content": [
           {
             "text": "Hi"
           }
         ]
       }
     ],
     "modelId": "anthropic.claude-3-5-sonnet-20240620-v1:0",
     "region": "us-west-2",
     "enableThinking": false,
     "system": [
       "text": "your system prompt"
     ]
   }'
   ```

   This API is used to implement streaming conversations for v2, and it returns the raw Amazon Bedrock response json string chunk splited by `\n\n`,
   you need to parse it for display.

   The `messages` under body fully complies with the messages structure specification in Amazon
   Bedrock [converse stream](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/bedrock-runtime/client/converse_stream.html)
   API. You can also add `image` or `document` according to the specification to support multimodal conversations.

2. `/api/image`

   ```bash
   curl "${API_URL}/api/image" \
   --header 'Content-Type: application/json' \
   --header "Authorization: Bearer ${API_KEY}" \
   --data '{
     "prompt": "Beautiful countryside",
     "modelId": "stability.stable-image-core-v1:0",
     "region": "us-west-2",
     "width": "1024",
     "height": "1024"
   }'
   ```

   This API is used to generate images and returns a base64 encoded string of the image.

3. `/api/models`

   ```bash
   curl "${API_URL}/api/models" \
   --header 'Content-Type: application/json' \
   --header 'accept: application/json' \
   --header "Authorization: Bearer ${API_KEY}" \
   --data '{
     "region": "us-west-2"
   }'
   ```

   This API is used to get a list of all streaming-supported text models and image generation models in the specified
   region.

4. `/api/upgrade`
   ```bash
   curl "${API_URL}/api/upgrade" \
   --header 'Content-Type: application/json' \
   --header 'accept: application/json' \
   --header "Authorization: Bearer ${API_KEY}"
   ```
   This API is used to get the new version of AI Assistant for Android and macOS App updates.

### API Code Reference

- Client code: [bedrock-api.ts](../react-native/src/api/bedrock-api.ts)

- Server code: [main.py](src/main.py)
