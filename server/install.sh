#!/bin/bash
# SwiftChat Server — one-command deploy
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/aws-samples/swift-chat/main/server/install.sh | bash
#   curl ... | bash -s -- --region us-west-2
#   ./install.sh                                 # from cloned repo
#   ./install.sh --region us-west-2
#   ./install.sh --region us-west-2 --stack MySwiftChat
#   ./install.sh --profile myprofile --region us-west-2

main() {
set -euo pipefail

# Colors (only when stdout is a terminal)
if [ -t 1 ]; then
  C_GREEN=$'\033[1;32m'; C_RED=$'\033[1;31m'; C_BOLD=$'\033[1m'; C_RESET=$'\033[0m'
else
  C_GREEN=""; C_RED=""; C_BOLD=""; C_RESET=""
fi
LINE="=================================================================="

# On any error, print the failing line + command
trap 'rc=$?; echo ""; echo "${C_RED}ERROR: install.sh failed at line $LINENO (exit $rc): $BASH_COMMAND${C_RESET}" >&2; exit $rc' ERR

# ===== Self-bootstrap: if not inside the repo, clone it first =====
REPO_URL="https://github.com/aws-samples/swift-chat.git"
SELF_MARKER="server/template/SwiftChatLambda.template"

if [ ! -f "$(dirname "${BASH_SOURCE[0]:-$0}")/../$SELF_MARKER" ] 2>/dev/null; then
  # Check git
  if ! command -v git >/dev/null 2>&1; then
    echo "${C_RED}ERROR: git is required but not installed.${C_RESET}"
    case "$(uname -s)" in
      Darwin) echo "  Install: ${C_BOLD}xcode-select --install${C_RESET}" ;;
      Linux)  echo "  Install: ${C_BOLD}sudo apt install git${C_RESET} or ${C_BOLD}sudo yum install git${C_RESET}" ;;
    esac
    exit 1
  fi

  # Check AWS CLI
  if ! command -v aws >/dev/null 2>&1; then
    echo "${C_RED}ERROR: AWS CLI is required but not installed.${C_RESET}"
    echo "  Install: ${C_BOLD}https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html${C_RESET}"
    exit 1
  fi

  CLONE_DIR=$(mktemp -d)
  trap 'rm -rf "$CLONE_DIR"' EXIT
  echo "Cloning swift-chat..."
  if ! git clone --depth 1 --quiet "$REPO_URL" "$CLONE_DIR/swift-chat"; then
    echo "${C_RED}ERROR: Failed to clone repository${C_RESET}"
    exit 1
  fi
  set +e
  bash "$CLONE_DIR/swift-chat/server/install.sh" "$@"
  exit $?
fi

# Poll CloudFormation stack status every 5 seconds (vs 30s for `aws cloudformation wait`)
wait_stack() {
  local target_status="$1"
  while true; do
    local s
    s=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
      --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "")
    case "$s" in
      "$target_status") return 0 ;;
      *FAILED*|*ROLLBACK*) return 1 ;;
      "") return 1 ;;
    esac
    sleep 5
  done
}

# ===== Parse args =====
REGION=""
STACK_NAME="SwiftChat"
REPO_NAME="swift-chat-api"
TAG="latest"
PROFILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --region)  REGION="$2"; shift 2 ;;
    --stack)   STACK_NAME="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --repo)    REPO_NAME="$2"; shift 2 ;;
    --tag)     TAG="$2"; shift 2 ;;
    -h|--help)
      head -n 10 "$0" | tail -n 7
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Apply profile to all subsequent aws calls
if [ -n "$PROFILE" ]; then
  export AWS_PROFILE="$PROFILE"
fi

# Resolve region: --region > $AWS_REGION > aws configure > us-east-1
if [ -z "$REGION" ]; then
  REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || echo '')}"
  REGION="${REGION:-us-east-1}"
fi

# ===== Prerequisites =====
command -v aws >/dev/null 2>&1 || { echo "ERROR: AWS CLI required"; exit 1; }

# Check AWS credentials. Capture stderr so the user sees the real reason
# (missing / expired / invalid token) rather than a generic message.
STS_OUT=$(aws sts get-caller-identity --region "$REGION" --output text --query Account 2>&1) || {
  echo "${C_RED}ERROR: AWS credentials are not usable${PROFILE:+ for profile '$PROFILE'}.${C_RESET}" >&2
  echo "$STS_OUT" | sed 's/^/  /' >&2
  if echo "$STS_OUT" | grep -qE "ExpiredToken|InvalidClientTokenId|SignatureDoesNotMatch|token.*expired"; then
    echo "  Hint: refresh credentials (${C_BOLD}aws sso login${C_RESET} or update temporary keys) and retry." >&2
  else
    echo "  Hint: run ${C_BOLD}aws configure${C_RESET} to set up credentials." >&2
  fi
  exit 1
}
ACCOUNT_ID="$STS_OUT"

echo "Deploying SwiftChat → region=$REGION, stack=$STACK_NAME, account=$ACCOUNT_ID"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
TEMPLATE="$SCRIPT_DIR/template/SwiftChatLambda.template"
REPO_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}"
S3_BUCKET="swiftchat-build-${ACCOUNT_ID}-${REGION}"
CODEBUILD_PROJECT="${STACK_NAME}-build"
CODEBUILD_ROLE="${STACK_NAME}-codebuild-role"

# ===== Step 1: Prepare build resources =====
echo "[1/4] Preparing build resources..."

aws s3 mb "s3://${S3_BUCKET}" --region "$REGION" >/dev/null 2>&1 || true
aws ecr create-repository --repository-name "$REPO_NAME" --region "$REGION" >/dev/null 2>&1 || true

# Package source + buildspec.yml into one zip (CodeBuild reads buildspec.yml from the zip root)
SRC_ZIP="/tmp/swiftchat-src-$$.zip"
BUILDSPEC_DIR=$(mktemp -d)
cat > "$BUILDSPEC_DIR/buildspec.yml" <<'EOF'
version: 0.2
phases:
  pre_build:
    commands:
      - ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
      - REPO_URI="$ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$REPO_NAME"
      - aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $REPO_URI
  build:
    commands:
      - docker build -t $REPO_NAME:$TAG -f Dockerfile .
      - docker tag $REPO_NAME:$TAG $REPO_URI:$TAG
  post_build:
    commands:
      - docker push $REPO_URI:$TAG
EOF
(cd "$SRC_DIR" && zip -qr "$SRC_ZIP" .)
(cd "$BUILDSPEC_DIR" && zip -q "$SRC_ZIP" buildspec.yml)
rm -rf "$BUILDSPEC_DIR"
aws s3 cp "$SRC_ZIP" "s3://${S3_BUCKET}/build/src.zip" --region "$REGION" --only-show-errors
rm -f "$SRC_ZIP"

# CodeBuild role (create if missing). Propagation is handled by retrying create-project below.
if ! aws iam get-role --role-name "$CODEBUILD_ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$CODEBUILD_ROLE" \
    --assume-role-policy-document '{
      "Version":"2012-10-17",
      "Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]
    }' >/dev/null
fi
aws iam put-role-policy --role-name "$CODEBUILD_ROLE" --policy-name build-policy \
  --policy-document '{
    "Version":"2012-10-17",
    "Statement":[
      {"Effect":"Allow","Action":["ecr:*"],"Resource":"*"},
      {"Effect":"Allow","Action":["ecr-public:GetAuthorizationToken","sts:GetServiceBearerToken"],"Resource":"*"},
      {"Effect":"Allow","Action":["s3:GetObject","s3:GetObjectVersion"],"Resource":"arn:aws:s3:::'"$S3_BUCKET"'/*"},
      {"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],"Resource":"*"}
    ]
  }' >/dev/null

# ===== Step 2: Build via CodeBuild =====
echo "[2/4] Building image via CodeBuild..."

# buildspec.yml is packed inside src.zip — CodeBuild will pick it up automatically.
# Pass REPO_NAME / TAG as build-time env vars so buildspec stays static.
ENV_OVERRIDES="name=REPO_NAME,value=${REPO_NAME},type=PLAINTEXT name=TAG,value=${TAG},type=PLAINTEXT"

PROJECT_EXISTS=$(aws codebuild batch-get-projects --names "$CODEBUILD_PROJECT" --region "$REGION" \
  --query 'projects[0].name' --output text 2>/dev/null | grep -q "$CODEBUILD_PROJECT" && echo true || echo false)

# Retry create/update until CodeBuild sees the IAM role (propagation can take 1-3 min for new roles)
for i in $(seq 1 36); do  # up to ~3 minutes
  if [ "$PROJECT_EXISTS" = "true" ]; then
    ERR=$(aws codebuild update-project --name "$CODEBUILD_PROJECT" --region "$REGION" \
      --source "type=S3,location=${S3_BUCKET}/build/src.zip" \
      --service-role "arn:aws:iam::${ACCOUNT_ID}:role/${CODEBUILD_ROLE}" 2>&1 >/dev/null) && break
  else
    ERR=$(aws codebuild create-project --name "$CODEBUILD_PROJECT" --region "$REGION" \
      --source "type=S3,location=${S3_BUCKET}/build/src.zip" \
      --artifacts "type=NO_ARTIFACTS" \
      --environment "type=ARM_CONTAINER,image=aws/codebuild/amazonlinux2-aarch64-standard:3.0,computeType=BUILD_GENERAL1_SMALL,privilegedMode=true" \
      --service-role "arn:aws:iam::${ACCOUNT_ID}:role/${CODEBUILD_ROLE}" 2>&1 >/dev/null) && break
  fi
  if echo "$ERR" | grep -qE "InvalidInputException|not authorized|cannot be assumed"; then
    sleep 5
  else
    echo "$ERR" >&2
    exit 1
  fi
done

BUILD_ID=$(aws codebuild start-build --project-name "$CODEBUILD_PROJECT" --region "$REGION" \
  --environment-variables-override $ENV_OVERRIDES \
  --query 'build.id' --output text)

while true; do
  STATUS=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --region "$REGION" \
    --query 'builds[0].buildStatus' --output text)
  [ "$STATUS" != "IN_PROGRESS" ] && break
  sleep 5
done

if [ "$STATUS" != "SUCCEEDED" ]; then
  echo ""
  echo "ERROR: CodeBuild finished with status: $STATUS"
  # Print any failure contexts from phases (ACCESS_DENIED, image-pull failures, etc.)
  aws codebuild batch-get-builds --ids "$BUILD_ID" --region "$REGION" \
    --query 'builds[0].phases[?phaseStatus!=`SUCCEEDED` && phaseStatus!=null].[phaseType,phaseStatus,contexts[0].message]' \
    --output text 2>/dev/null | sed 's/^/  /'
  # Tail CloudWatch logs if available
  LOG_GROUP=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --region "$REGION" \
    --query 'builds[0].logs.groupName' --output text 2>/dev/null || echo "")
  LOG_STREAM=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --region "$REGION" \
    --query 'builds[0].logs.streamName' --output text 2>/dev/null || echo "")
  if [ -n "$LOG_GROUP" ] && [ "$LOG_GROUP" != "None" ] && [ -n "$LOG_STREAM" ] && [ "$LOG_STREAM" != "None" ]; then
    echo ""
    echo "  --- Last log lines ---"
    aws logs get-log-events --log-group-name "$LOG_GROUP" --log-stream-name "$LOG_STREAM" \
      --region "$REGION" --limit 30 --query 'events[*].message' --output text 2>/dev/null | tail -30 | sed 's/^/  /'
  fi
  echo ""
  echo "  Full logs: https://console.aws.amazon.com/codesuite/codebuild/projects/${CODEBUILD_PROJECT}/build/${BUILD_ID}"
  exit 1
fi

# ===== Step 3: Deploy CloudFormation =====
echo "[3/4] Deploying CloudFormation stack..."
IMAGE_URI="$REPO_URI:$TAG"

# Print failure reason when a CFN wait fails
cfn_dump_failure() {
  echo ""
  echo "ERROR: CloudFormation stack operation failed. Failed resources:"
  aws cloudformation describe-stack-events --stack-name "$STACK_NAME" --region "$REGION" \
    --query 'StackEvents[?contains(ResourceStatus,`FAILED`) || contains(ResourceStatus,`ROLLBACK`)].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' \
    --output text 2>/dev/null | head -20 | sed 's/^/  /'
  exit 1
}

STACK_STATUS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DOES_NOT_EXIST")

if [ "$STACK_STATUS" = "DOES_NOT_EXIST" ]; then
  aws cloudformation create-stack \
    --stack-name "$STACK_NAME" --region "$REGION" \
    --template-body "file://$TEMPLATE" \
    --parameters "ParameterKey=ContainerImageUri,ParameterValue=$IMAGE_URI" \
    --capabilities CAPABILITY_IAM >/dev/null
  wait_stack "CREATE_COMPLETE" || cfn_dump_failure
else
  if aws cloudformation update-stack \
       --stack-name "$STACK_NAME" --region "$REGION" \
       --template-body "file://$TEMPLATE" \
       --parameters "ParameterKey=ContainerImageUri,ParameterValue=$IMAGE_URI" \
       --capabilities CAPABILITY_IAM >/dev/null 2>&1; then
    wait_stack "UPDATE_COMPLETE" || cfn_dump_failure
  fi
fi

# Force-refresh Lambda to latest image (tag may be reused)
REST_FUNC=$(aws cloudformation describe-stack-resources --stack-name "$STACK_NAME" --region "$REGION" \
  --query "StackResources[?starts_with(LogicalResourceId,'APIHandler')].PhysicalResourceId | [0]" --output text)
if [ -n "$REST_FUNC" ] && [ "$REST_FUNC" != "None" ]; then
  aws lambda update-function-code --function-name "$REST_FUNC" \
    --image-uri "$IMAGE_URI" --region "$REGION" >/dev/null
  aws lambda wait function-updated --function-name "$REST_FUNC" --region "$REGION"
fi

# ===== Step 4: Fetch outputs =====
echo "[4/4] Fetching outputs..."

API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`APIURL`].OutputValue' --output text)

KEY_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiKeyId`].OutputValue' --output text 2>/dev/null || echo "")
if [ -z "$KEY_ID" ] || [ "$KEY_ID" = "None" ]; then
  KEY_ID=$(aws apigateway get-api-keys --region "$REGION" \
    --query "items[?name=='${STACK_NAME}-api-key'].id | [0]" --output text)
fi
API_KEY=$(aws apigateway get-api-key --api-key "$KEY_ID" --include-value --region "$REGION" \
  --query 'value' --output text)

API_KEY_CONSOLE="https://${REGION}.console.aws.amazon.com/apigateway/main/api-keys?region=${REGION}"

echo ""
echo "${C_GREEN}${LINE}${C_RESET}"
echo "${C_GREEN}${C_BOLD}  ✅ Deploy successful!${C_RESET}"
echo "${C_GREEN}${LINE}${C_RESET}"
echo "  ${C_BOLD}API URL:${C_RESET}     $API_URL"
echo "  ${C_BOLD}API Key:${C_RESET}     open $API_KEY_CONSOLE"
echo "               and copy the key named '${STACK_NAME}-api-key'"
echo "${C_GREEN}${LINE}${C_RESET}"

# Print scannable QR if Node.js is available (non-fatal if not)
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  QR_CACHE="$HOME/.cache/swiftchat-qr"
  QR_PAYLOAD=$(printf '{"apiUrl":"%s","apiKey":"%s"}' "$API_URL" "$API_KEY")
  echo ""
  echo "  ${C_BOLD}Scan to auto-configure the app:${C_RESET}"
  (
    mkdir -p "$QR_CACHE" && cd "$QR_CACHE"
    [ ! -d node_modules/qrcode-terminal ] && \
      npm install --silent --no-fund --no-audit qrcode-terminal@0.12.0 >/dev/null 2>&1
    QR_PAYLOAD="$QR_PAYLOAD" node -e \
      "require('qrcode-terminal').generate(process.env.QR_PAYLOAD,{small:true})" \
      2>/dev/null | sed 's/^/  /'
  ) || true
fi
}

main "$@"
