terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }

  required_version = ">= 1.2.0"

  backend "s3" {
    bucket = "dbn-berg-industries-tf-state20230217203011463900000001"
    key    = "tf-state"
    region = "us-east-2"
  }
}

provider "aws" {
  region = "us-east-2"

  default_tags {
    tags = {
      "Repository" = "brendanberg/dbn"
    }
  }
}

provider "aws" {
  alias  = "acm_provider"
  region = "us-east-1"

  default_tags {
    tags = {
      "Repository" = "brendanberg/dbn"
    }
  }
}

provider "aws" {
  alias  = "cloudwatch_provider"
  region = "us-east-1"

  default_tags {
    tags = {
      "Repository" = "brendanberg/dbn"
    }
  }
}

provider "aws" {
  alias  = "route53_provider"
  region = "us-east-1"

  default_tags {
    tags = {
      "Repository" = "brendanberg/dbn"
    }
  }

  assume_role {
    role_arn = "arn:aws:iam::${var.route53_provider_account_id}:role/${var.route53_role_name}"
  }
}

variable "route53_provider_account_id" {
  type = string
}

variable "route53_role_name" {
  type = string
}

# variable "route53_name" {
#   type = string
# }

variable "name" {
  type = string
}

variable "domain_name" {
  type = string
}

variable "subdomain" {
  type = string
}

variable "sandbox_domain" {
  type = string
}

variable "repository" {
  type = string
}

variable "alarm_subscriber_email" {
  type = string
}

locals {
  fqdn = "${var.subdomain}.${var.domain_name}"
  sandbox_fqdn = "${var.subdomain}.${var.sandbox_domain}"
  account_id = data.aws_caller_identity.current.account_id
}

data "aws_route53_zone" "default" {
  provider     = aws.route53_provider
  name         = var.domain_name
  private_zone = false
}

data "aws_route53_zone" "sandbox" {
  provider = aws.route53_provider
  name = var.sandbox_domain
  private_zone = false
}

data "aws_caller_identity" "current" {}
