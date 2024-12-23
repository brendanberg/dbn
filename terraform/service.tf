
# Lambda at Edge as CF origin for /api.v1/*
resource "aws_lambda_function" "network" {
  provider = aws.acm_provider

  function_name = "${replace(var.name, " ", "")}NetworkConnector"
  role          = aws_iam_role.network_lambda.arn
  architectures = ["x86_64"]

  filename         = "../dist/network.zip"
  source_code_hash = data.archive_file.network_zip.output_base64sha256
  handler          = "network.handler"
  runtime          = "nodejs18.x"
  publish          = true

  # environment {
  #   variables = {
  #     DDB_TABLE_NAME = aws_dynamodb_table.network.name
  #   }
  # }
}

data "archive_file" "network_zip" {
  type        = "zip"
  source_file = "../service/network.js"
  output_path = "../dist/network.zip"
}

resource "aws_iam_role" "network_lambda" {
  provider = aws.acm_provider

  name               = "${replace(var.name, " ", "")}ExecutionRole"
  assume_role_policy = data.aws_iam_policy_document.network_role_policy.json
}

resource "aws_iam_policy" "lambda_ddb_access" {
  name   = "${replace(var.name, " ", "")}LambdaDdbPolicy"
  policy = data.aws_iam_policy_document.lambda_ddb_access.json
}

resource "aws_iam_role_policy_attachment" "network_lambda" {
  provider   = aws.acm_provider
  role       = aws_iam_role.network_lambda.name
  policy_arn = aws_iam_policy.lambda_ddb_access.arn
}

resource "aws_iam_role_policy_attachment" "lambda_execution" {
  provider   = aws.acm_provider
  role       = aws_iam_role.network_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_ddb_access" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:BatchGet*",
      "dynamodb:DescribeStream",
      "dynamodb:DescribeTable",
      "dynamodb:Get*",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchWrite*",
      "dynamodb:Update*",
      "dynamodb:PutItem"
    ]
    resources = [
      aws_dynamodb_table.network.arn
    ]
  }
}

data "aws_iam_policy_document" "network_role_policy" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type = "Service"
      identifiers = [
        "lambda.amazonaws.com",
        "edgelambda.amazonaws.com"
      ]
    }
  }
}

resource "aws_dynamodb_table" "network" {
  provider = aws.acm_provider

  name         = "${replace(var.name, " ", "")}NetworkConnector"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "Address"
  # billing_mode   = "PROVISIONED"
  # read_capacity  = 20
  # write_capacity = 20

  attribute {
    name = "Address"
    type = "N"
  }
}
