output "iam_policy_arn" {
  value = {
    oidc_deploy = aws_iam_policy.github-deploy-policy.arn
  }
}
