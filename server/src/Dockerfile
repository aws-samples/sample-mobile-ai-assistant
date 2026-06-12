FROM public.ecr.aws/docker/library/python:3.12-alpine
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /app
COPY requirements.txt .
COPY main.py .
COPY mantle.py .
COPY image_nl_processor.py .
RUN pip install --no-cache-dir -r requirements.txt

CMD ["python", "main.py"]
