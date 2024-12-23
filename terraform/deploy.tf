
data "aws_iam_openid_connect_provider" "default" {
  arn = "arn:aws:iam::101672552205:oidc-provider/token.actions.githubusercontent.com"
}

resource "aws_iam_role" "github-deploy" {
  name_prefix          = "${replace(var.name, " ", "")}GithubActionsDeploy"
  max_session_duration = 3600
  assume_role_policy   = data.aws_iam_policy_document.assume-role-policy.json
}

resource "aws_iam_policy" "github-deploy-policy" {
  name   = "${replace(var.name, " ", "")}GithubActionsS3Policy"
  policy = data.aws_iam_policy_document.github-deploy-policy.json
}

resource "aws_iam_role_policy_attachment" "github-deploy-policy" {
  role       = aws_iam_role.github-deploy.name
  policy_arn = aws_iam_policy.github-deploy-policy.arn
}

data "aws_iam_policy_document" "github-deploy-policy" {
  statement {
    effect  = "Allow"
    actions = ["s3:ListBucket"]
    resources = [
      "${aws_s3_bucket.static-hosting.arn}",
    ]
  }
  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
    ]
    resources = [
      "${aws_s3_bucket.static-hosting.arn}",
      "${aws_s3_bucket.static-hosting.arn}/*",
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "cloudfront:CreateInvalidation",
    ]
    resources = [
      "${aws_cloudfront_distribution.static-hosting.arn}",
    ]
  }
}

data "aws_iam_policy_document" "assume-role-policy" {
  statement {
    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.default.id]
    }

    actions = ["sts:AssumeRoleWithWebIdentity"]

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.repository}:*"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values = [
        "sts.amazonaws.com"
      ]
    }
  }
}
