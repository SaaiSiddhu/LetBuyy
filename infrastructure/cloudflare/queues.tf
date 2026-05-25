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
  consumer_worker_dev     = "letbuyy-queue-workers-dev"
  consumer_worker_staging = "letbuyy-queue-workers-staging"

  queues = {
    events = {
      name            = "letbuyy-events"
      batch_size      = 50
      max_concurrency = 25
      max_retries     = 10
      wait_ms         = 10000
      retry_delay     = 30
    }
    analytics = {
      name            = "letbuyy-analytics"
      batch_size      = 50
      max_concurrency = 20
      max_retries     = 8
      wait_ms         = 10000
      retry_delay     = 30
    }
    search = {
      name            = "letbuyy-search-indexing"
      batch_size      = 25
      max_concurrency = 20
      max_retries     = 8
      wait_ms         = 10000
      retry_delay     = 45
    }
    notifications = {
      name            = "letbuyy-notifications"
      batch_size      = 25
      max_concurrency = 10
      max_retries     = 6
      wait_ms         = 10000
      retry_delay     = 60
    }
  }

  queues_dev = {
    events = {
      name            = "letbuyy-events-dev"
      batch_size      = 25
      max_concurrency = 5
      max_retries     = 6
      wait_ms         = 10000
      retry_delay     = 30
    }
    analytics = {
      name            = "letbuyy-analytics-dev"
      batch_size      = 25
      max_concurrency = 5
      max_retries     = 6
      wait_ms         = 10000
      retry_delay     = 30
    }
    search = {
      name            = "letbuyy-search-indexing-dev"
      batch_size      = 15
      max_concurrency = 5
      max_retries     = 6
      wait_ms         = 10000
      retry_delay     = 45
    }
    notifications = {
      name            = "letbuyy-notifications-dev"
      batch_size      = 15
      max_concurrency = 3
      max_retries     = 5
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
      name            = "letbuyy-analytics-staging"
      batch_size      = 50
      max_concurrency = 10
      max_retries     = 8
      wait_ms         = 10000
      retry_delay     = 30
    }
    search = {
      name            = "letbuyy-search-indexing-staging"
      batch_size      = 25
      max_concurrency = 10
      max_retries     = 8
      wait_ms         = 10000
      retry_delay     = 45
    }
    notifications = {
      name            = "letbuyy-notifications-staging"
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
  queue_name = "letbuyy-dead-letters"

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

resource "cloudflare_queue" "dead_letters_dev" {
  account_id = var.cloudflare_account_id
  queue_name = "letbuyy-dead-letters-dev"

  settings = {
    message_retention_period = local.queue_retention_seconds
  }
}

resource "cloudflare_queue" "runtime_dev" {
  for_each   = local.queues_dev
  account_id = var.cloudflare_account_id
  queue_name = each.value.name

  settings = {
    message_retention_period = local.queue_retention_seconds
  }
}

resource "cloudflare_queue_consumer" "runtime_dev" {
  for_each          = local.queues_dev
  account_id        = var.cloudflare_account_id
  queue_id          = cloudflare_queue.runtime_dev[each.key].queue_id
  script_name       = local.consumer_worker_dev
  type              = "worker"
  dead_letter_queue = cloudflare_queue.dead_letters_dev.queue_name

  settings = {
    batch_size        = each.value.batch_size
    max_concurrency   = each.value.max_concurrency
    max_retries       = each.value.max_retries
    max_wait_time_ms  = each.value.wait_ms
    retry_delay       = each.value.retry_delay
  }
}

resource "cloudflare_queue_consumer" "dead_letters_dev" {
  account_id  = var.cloudflare_account_id
  queue_id    = cloudflare_queue.dead_letters_dev.queue_id
  script_name = local.consumer_worker_dev
  type        = "worker"

  settings = {
    batch_size       = 10
    max_concurrency  = 2
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

output "letbuyy_queue_names" {
  value = concat(
    [cloudflare_queue.dead_letters.queue_name],
    [for queue in cloudflare_queue.runtime : queue.queue_name],
    [cloudflare_queue.dead_letters_dev.queue_name],
    [for queue in cloudflare_queue.runtime_dev : queue.queue_name],
    [cloudflare_queue.dead_letters_staging.queue_name],
    [for queue in cloudflare_queue.runtime_staging : queue.queue_name],
  )
}
