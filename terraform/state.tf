
resource "aws_s3_bucket" "tf-state" {
  bucket_prefix = "${replace(local.fqdn, ".", "-")}-tf-state"
}

resource "aws_s3_bucket_versioning" "tf-state-versioning" {
  bucket = aws_s3_bucket.tf-state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "tf-state-public-access" {
  bucket = aws_s3_bucket.tf-state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
