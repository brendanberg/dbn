
resource "aws_s3_bucket" "static-hosting" {
  bucket = local.fqdn
}

resource "aws_s3_bucket_policy" "public-read" {
  bucket = aws_s3_bucket.static-hosting.id
  policy = data.aws_iam_policy_document.public-read.json
}

resource "aws_s3_bucket_website_configuration" "static-hosting" {
  bucket = aws_s3_bucket.static-hosting.bucket

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "404.html"
  }
}

data "aws_iam_policy_document" "public-read" {
  statement {
    sid    = "PublicReadGetObject"
    effect = "Allow"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "${aws_s3_bucket.static-hosting.arn}/*"
    ]
  }
}

locals {
  s3_origin_id = "${var.name} via S3 Static Hosting"
}

resource "aws_cloudfront_distribution" "static-hosting" {
  origin {
    domain_name = aws_s3_bucket_website_configuration.static-hosting.website_endpoint
    origin_id   = local.s3_origin_id

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_keepalive_timeout = 5
      origin_protocol_policy   = "http-only"
      origin_read_timeout      = 10
      origin_ssl_protocols = [
        "TLSv1",
        "TLSv1.1",
        "TLSv1.2",
      ]
    }
  }

  aliases = [local.fqdn]

  ordered_cache_behavior {
    target_origin_id = local.s3_origin_id
    path_pattern     = "api.v1/*"

    allowed_methods = [
      "HEAD",
      "GET",
      "PUT",
      "POST",
      "PATCH",
      "OPTIONS",
      "DELETE",
    ]
    cached_methods = ["HEAD", "GET", "OPTIONS"]

    lambda_function_association {
      event_type   = "viewer-request"
      lambda_arn   = aws_lambda_function.network.qualified_arn
      include_body = true
    }

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    viewer_protocol_policy = "redirect-to-https"
    compress               = false
  }


  default_cache_behavior {
    target_origin_id = local.s3_origin_id
    allowed_methods = [
      "GET",
      "HEAD",
    ]
    cached_methods = [
      "GET",
      "HEAD"
    ]
    cache_policy_id        = aws_cloudfront_cache_policy.static-hosting.id
    viewer_protocol_policy = "redirect-to-https"
    compress               = false
  }

  default_root_object = "index.html"

  custom_error_response {
    error_code            = 500
    response_code         = 500
    response_page_path    = "/500.html"
    error_caching_min_ttl = 120
  }

  custom_error_response {
    error_code            = 502
    response_code         = 502
    response_page_path    = "/500.html"
    error_caching_min_ttl = 120
  }

  custom_error_response {
    error_code            = 503
    response_code         = 503
    response_page_path    = "/500.html"
    error_caching_min_ttl = 120
  }

  # logging_config

  viewer_certificate {
    acm_certificate_arn            = aws_acm_certificate.static-hosting.id
    cloudfront_default_certificate = false
    minimum_protocol_version       = "TLSv1.2_2019"
    ssl_support_method             = "sni-only"
  }

  enabled         = true
  is_ipv6_enabled = true
  comment         = var.name
  http_version    = "http2"

  restrictions {
    geo_restriction {
      restriction_type = "none"
      locations        = []
    }
  }
}

resource "aws_cloudfront_cache_policy" "static-hosting" {
  name    = "${replace(var.name, " ", "")}-DefaultCachePolicy"
  comment = "Default policy when CF compression is enabled"

  default_ttl = 86400
  max_ttl     = 31536000
  min_ttl     = 1

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

resource "aws_acm_certificate" "static-hosting" {
  provider                  = aws.acm_provider
  domain_name               = local.fqdn
  subject_alternative_names = []
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "static-hosting" {
  provider        = aws.acm_provider
  certificate_arn = aws_acm_certificate.static-hosting.arn
  validation_record_fqdns = [
    for record in aws_route53_record.static-hosting-domain-validation : record.fqdn
  ]
}

resource "aws_route53_record" "static-hosting-domain-validation" {
  provider = aws.route53_provider

  for_each = {
    for dvo in aws_acm_certificate.static-hosting.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.default.zone_id

  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_route53_record" "static-hosting" {
  provider = aws.route53_provider

  zone_id = data.aws_route53_zone.default.zone_id
  name    = local.fqdn
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.static-hosting.domain_name
    zone_id                = aws_cloudfront_distribution.static-hosting.hosted_zone_id
    evaluate_target_health = false
  }

  allow_overwrite = true
}
