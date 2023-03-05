locals {
  sandbox_name = "DBN Static Assets"
  sandbox_s3_origin_id = "Static assets S3 bucket"
}

resource "aws_s3_bucket" "static-assets" {
  bucket = local.sandbox_fqdn
}

resource "aws_s3_bucket_policy" "static-assets" {
  bucket = aws_s3_bucket.static-assets.id
  policy = data.aws_iam_policy_document.static-assets.json
}

data "aws_iam_policy_document" "static-assets" {
  statement {
    effect = "Allow"
    sid = "CloudFrontGetObject"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "${aws_s3_bucket.static-assets.arn}/*"
    ]

    condition {
      test = "StringEquals"
      variable = "AWS:SourceArn"
      values = [
        "arn:aws:cloudfront::${local.account_id}:distribution/${aws_cloudfront_distribution.static-assets.id}"
      ]
    }
  }
}

resource "aws_cloudfront_distribution" "static-assets" {
  origin {
    domain_name = aws_s3_bucket.static-assets.bucket_domain_name
    origin_id   = local.sandbox_s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.static-assets.id
  }

  aliases = [local.sandbox_fqdn]

  default_cache_behavior {
    target_origin_id = local.sandbox_s3_origin_id
    allowed_methods = [
      "GET",
      "HEAD",
    ]
    cached_methods = [
      "GET",
      "HEAD"
    ]
    cache_policy_id        = aws_cloudfront_cache_policy.static-assets.id
    viewer_protocol_policy = "redirect-to-https"
    compress               = false
  }

  default_root_object = "index.html"

  custom_error_response {
    error_code            = 403
    response_code         = 403
    response_page_path    = "/index.html"
    error_caching_min_ttl = 120
  }

  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/index.html"
    error_caching_min_ttl = 120
  }

  custom_error_response {
    error_code            = 500
    response_code         = 500
    response_page_path    = "/index.html"
    error_caching_min_ttl = 120
  }

  custom_error_response {
    error_code            = 502
    response_code         = 502
    response_page_path    = "/index.html"
    error_caching_min_ttl = 120
  }

  custom_error_response {
    error_code            = 503
    response_code         = 503
    response_page_path    = "/index.html"
    error_caching_min_ttl = 120
  }

  # logging_config

  viewer_certificate {
    acm_certificate_arn            = aws_acm_certificate.static-assets.id
    cloudfront_default_certificate = false
    minimum_protocol_version       = "TLSv1.2_2019"
    ssl_support_method             = "sni-only"
  }

  enabled         = true
  is_ipv6_enabled = true
  comment         = local.sandbox_name
  http_version    = "http2"

  restrictions {
    geo_restriction {
      restriction_type = "none"
      locations        = []
    }
  }
}

resource "aws_cloudfront_origin_access_control" "static-assets" {
  name                              = "dbn.artist-content.com.s3.amazonaws.com"
  description                       = "S3 bucket access control"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_cache_policy" "static-assets" {
  name    = "${replace(local.sandbox_name, " ", "")}-DefaultCachePolicy"
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

resource "aws_acm_certificate" "static-assets" {
  provider                  = aws.acm_provider
  domain_name               = local.sandbox_fqdn
  subject_alternative_names = []
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "static-assets" {
  provider        = aws.acm_provider
  certificate_arn = aws_acm_certificate.static-assets.arn
  validation_record_fqdns = [
    for record in aws_route53_record.static-assets-domain-validation : record.fqdn
  ]
}

resource "aws_route53_record" "static-assets-domain-validation" {
  provider = aws.route53_provider

  for_each = {
    for dvo in aws_acm_certificate.static-assets.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.sandbox.zone_id

  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_route53_record" "static-assets" {
  provider = aws.route53_provider

  zone_id = data.aws_route53_zone.sandbox.zone_id
  name    = local.sandbox_fqdn
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.static-assets.domain_name
    zone_id                = aws_cloudfront_distribution.static-assets.hosted_zone_id
    evaluate_target_health = false
  }

  allow_overwrite = true
}
