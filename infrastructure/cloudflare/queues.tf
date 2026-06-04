terraform {
  required_version = ">= 1.7.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.19"
    }
  }
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID that owns LetBuyy Workers and Queues."
}

variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "Cloudflare API token with Queues and Workers script permissions."
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

locals {
  queue_retention_seconds = 1209600
  consumer_worker         = "letbuyy-queue-workers"
  consumer_worker_staging = "letbuyy-queue-workers-staging"

  foundation_runtime_queues = {
    staging = {
      queue_name             = "letbuyy-staging-queue"
      dead_letter_queue_name = "letbuyy-staging-dead-letter-queue"
      consumer_worker        = local.consumer_worker_staging
      batch_size             = 50
      max_concurrency        = 10
      max_retries            = 8
      wait_ms                = 10000
      retry_delay            = 30
    }
    production = {
      queue_name             = "letbuyy-production-queue"
      dead_letter_queue_name = "letbuyy-production-dead-letter-queue"
      consumer_worker        = local.consumer_worker
      batch_size             = 50
      max_concurrency        = 20
      max_retries            = 10
      wait_ms                = 10000
      retry_delay            = 30
    }
  }

  queues = {
    events = {
      name            = "letbuyy-events-production"
      batch_size      = 50
      max_concurrency = 25
      max_retries     = 10
      wait_ms         = 10000
      retry_delay     = 30
    }
    analytics = {
      name            = "letbuyy-analytics-queue-production"
      batch_size      = 50
      max_concurrency = 20
      max_retries     = 8
      wait_ms         = 10000
      retry_delay     = 30
    }
    search = {
      name            = "letbuyy-search-queue-production"
      batch_size      = 25
      max_concurrency = 20
      max_retries     = 8
      wait_ms         = 10000
      retry_delay     = 45
    }
    notifications = {
      name            = "letbuyy-notifications-queue-production"
      batch_size      = 25
      max_concurrency = 10
      max_retries     = 6
      wait_ms         = 10000
      retry_delay     = 60
    }
  }

  queues_staging = {
    events = {
      name            = "letbuyy-events-staging"
      batch_size      = 50
      max_concurrency = 10
      max_retries     = 10
      wait_ms         = 10000
      retry_delay     = 30
    }
    analytics = {
      name            = "letbuyy-analytics-queue-staging"
      batch_size      = 50
      max_concurrency = 10
      max_retries     = 8
      wait_ms         = 10000
      retry_delay     = 30
    }
    search = {
      name            = "letbuyy-search-queue-staging"
      batch_size      = 25
      max_concurrency = 10
      max_retries     = 8
      wait_ms         = 10000
      retry_delay     = 45
    }
    notifications = {
      name            = "letbuyy-notifications-queue-staging"
      batch_size      = 25
      max_concurrency = 5
      max_retries     = 6
      wait_ms         = 10000
      retry_delay     = 60
    }
  }
}

resource "cloudflare_queue" "dead_letters" {
  account_id = var.cloudflare_account_id
  queue_name = "letbuyy-dead-letters-production"

  settings = {
    message_retention_period = local.queue_retention_seconds
  }
}

resource "cloudflare_queue" "runtime" {
  for_each   = local.queues
  account_id = var.cloudflare_account_id
  queue_name = each.value.name

  settings = {
    message_retention_period = local.queue_retention_seconds
  }
}

resource "cloudflare_queue_consumer" "runtime" {
  for_each          = local.queues
  account_id        = var.cloudflare_account_id
  queue_id          = cloudflare_queue.runtime[each.key].queue_id
  script_name       = local.consumer_worker
  type              = "worker"
  dead_letter_queue = cloudflare_queue.dead_letters.queue_name

  settings = {
    batch_size        = each.value.batch_size
    max_concurrency   = each.value.max_concurrency
    max_retries       = each.value.max_retries
    max_wait_time_ms  = each.value.wait_ms
    retry_delay       = each.value.retry_delay
  }
}

resource "cloudflare_queue_consumer" "dead_letters" {
  account_id  = var.cloudflare_account_id
  queue_id    = cloudflare_queue.dead_letters.queue_id
  script_name = local.consumer_worker
  type        = "worker"

  settings = {
    batch_size       = 25
    max_concurrency  = 5
    max_retries      = 3
    max_wait_time_ms = 30000
    retry_delay      = 300
  }
}

resource "cloudflare_queue" "dead_letters_staging" {
  account_id = var.cloudflare_account_id
  queue_name = "letbuyy-dead-letters-staging"

  settings = {
    message_retention_period = local.queue_retention_seconds
  }
}

resource "cloudflare_queue" "runtime_staging" {
  for_each   = local.queues_staging
  account_id = var.cloudflare_account_id
  queue_name = each.value.name

  settings = {
    message_retention_period = local.queue_retention_seconds
  }
}

resource "cloudflare_queue_consumer" "runtime_staging" {
  for_each          = local.queues_staging
  account_id        = var.cloudflare_account_id
  queue_id          = cloudflare_queue.runtime_staging[each.key].queue_id
  script_name       = local.consumer_worker_staging
  type              = "worker"
  dead_letter_queue = cloudflare_queue.dead_letters_staging.queue_name

  settings = {
    batch_size        = each.value.batch_size
    max_concurrency   = each.value.max_concurrency
    max_retries       = each.value.max_retries
    max_wait_time_ms  = each.value.wait_ms
    retry_delay       = each.value.retry_delay
  }
}

resource "cloudflare_queue_consumer" "dead_letters_staging" {
  account_id  = var.cloudflare_account_id
  queue_id    = cloudflare_queue.dead_letters_staging.queue_id
  script_name = local.consumer_worker_staging
  type        = "worker"

  settings = {
    batch_size       = 25
    max_concurrency  = 3
    max_retries      = 3
    max_wait_time_ms = 30000
    retry_delay      = 300
  }
}

resource "cloudflare_queue" "foundation_runtime" {
  for_each   = local.foundation_runtime_queues
  account_id = var.cloudflare_account_id
  queue_name = each.value.queue_name

  settings = {
    message_retention_period = local.queue_retention_seconds
  }
}

resource "cloudflare_queue" "foundation_dead_letters" {
  for_each   = local.foundation_runtime_queues
  account_id = var.cloudflare_account_id
  queue_name = each.value.dead_letter_queue_name

  settings = {
    message_retention_period = local.queue_retention_seconds
  }
}

resource "cloudflare_queue_consumer" "foundation_runtime" {
  for_each          = local.foundation_runtime_queues
  account_id        = var.cloudflare_account_id
  queue_id          = cloudflare_queue.foundation_runtime[each.key].queue_id
  script_name       = each.value.consumer_worker
  type              = "worker"
  dead_letter_queue = cloudflare_queue.foundation_dead_letters[each.key].queue_name

  settings = {
    batch_size       = each.value.batch_size
    max_concurrency  = each.value.max_concurrency
    max_retries      = each.value.max_retries
    max_wait_time_ms = each.value.wait_ms
    retry_delay      = each.value.retry_delay
  }
}

resource "cloudflare_queue_consumer" "foundation_dead_letters" {
  for_each    = local.foundation_runtime_queues
  account_id  = var.cloudflare_account_id
  queue_id    = cloudflare_queue.foundation_dead_letters[each.key].queue_id
  script_name = each.value.consumer_worker
  type        = "worker"

  settings = {
    batch_size       = 25
    max_concurrency  = 5
    max_retries      = 3
    max_wait_time_ms = 30000
    retry_delay      = 300
  }
}

output "letbuyy_queue_names" {
  value = concat(
    [cloudflare_queue.dead_letters.queue_name],
    [for queue in cloudflare_queue.runtime : queue.queue_name],
    [cloudflare_queue.dead_letters_staging.queue_name],
    [for queue in cloudflare_queue.runtime_staging : queue.queue_name],
    [for queue in cloudflare_queue.foundation_runtime : queue.queue_name],
    [for queue in cloudflare_queue.foundation_dead_letters : queue.queue_name],
  )
}
