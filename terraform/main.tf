terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.82"
    }
  }

  required_version = ">= 1.2.0"

  backend "s3" {
    encrypt        = false
    region         = "us-east-1"
    bucket         = "berg-industries-101672552205-us-east-1-tfstate"
    dynamodb_table = "berg-industries-101672552205-us-east-1-tfstate-lock"
    key            = "brendanberg/dbn"
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
  fqdn         = "${var.subdomain}.${var.domain_name}"
  sandbox_fqdn = "${var.subdomain}.${var.sandbox_domain}"
  account_id   = data.aws_caller_identity.current.account_id
}

data "aws_route53_zone" "default" {
  provider     = aws.route53_provider
  name         = var.domain_name
  private_zone = false
}

data "aws_route53_zone" "sandbox" {
  provider     = aws.route53_provider
  name         = var.sandbox_domain
  private_zone = false
}

data "aws_caller_identity" "current" {}
