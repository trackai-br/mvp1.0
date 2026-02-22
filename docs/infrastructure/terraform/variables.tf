variable "aws_region" {
  description = "AWS region where resources will be created"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS Account ID (12 digits)"
  type        = string
  sensitive   = true
}

variable "app_name" {
  description = "Application name (used for naming resources)"
  type        = string
  default     = "hub-server-side-tracking"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "production"
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

# ─────────────────────────────────────────────────────────────
# ECR Configuration
# ─────────────────────────────────────────────────────────────

variable "ecr_image_tag" {
  description = "ECR image tag"
  type        = string
  default     = "latest"
}

variable "ecr_image_mutability" {
  description = "ECR image mutability (MUTABLE or IMMUTABLE)"
  type        = string
  default     = "MUTABLE"
}

# ─────────────────────────────────────────────────────────────
# ECS Configuration
# ─────────────────────────────────────────────────────────────

variable "ecs_task_cpu" {
  description = "ECS task CPU units (256=0.25vCPU, 512=0.5vCPU, 1024=1vCPU)"
  type        = number
  default     = 256
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.ecs_task_cpu)
    error_message = "ECS task CPU must be 256, 512, 1024, 2048, or 4096."
  }
}

variable "ecs_task_memory" {
  description = "ECS task memory (MB)"
  type        = number
  default     = 512
  validation {
    condition     = contains([512, 1024, 2048, 3072, 4096, 5120, 6144, 7168, 8192], var.ecs_task_memory)
    error_message = "ECS task memory must be a valid Fargate value (512, 1024, 2048, etc.)"
  }
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

variable "ecs_deployment_minimum_percent" {
  description = "Minimum healthy percent during deployment"
  type        = number
  default     = 100
}

variable "ecs_deployment_maximum_percent" {
  description = "Maximum healthy percent during deployment"
  type        = number
  default     = 200
}

# ─────────────────────────────────────────────────────────────
# RDS Configuration
# ─────────────────────────────────────────────────────────────

variable "rds_instance_class" {
  description = "RDS instance type (db.t4g.micro, db.t4g.small, etc.)"
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage (GB)"
  type        = number
  default     = 20
  validation {
    condition     = var.rds_allocated_storage >= 20
    error_message = "RDS allocated storage must be at least 20 GB."
  }
}

variable "rds_storage_type" {
  description = "RDS storage type (gp3 or io1)"
  type        = string
  default     = "gp3"
}

variable "rds_backup_retention" {
  description = "RDS backup retention period (days)"
  type        = number
  default     = 7
}

variable "rds_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16.1"
}

variable "rds_multi_az" {
  description = "Enable Multi-AZ for high availability"
  type        = bool
  default     = false
}

variable "rds_publicly_accessible" {
  description = "Make RDS instance publicly accessible (not recommended for production)"
  type        = bool
  default     = false
}

variable "rds_master_username" {
  description = "RDS master username"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "rds_master_password" {
  description = "RDS master password (generate strong password: $(openssl rand -base64 32))"
  type        = string
  sensitive   = true
}

# ─────────────────────────────────────────────────────────────
# ElastiCache Redis Configuration
# ─────────────────────────────────────────────────────────────

variable "redis_node_type" {
  description = "Redis node type (cache.t4g.micro, cache.t4g.small, etc.)"
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 1
}

variable "redis_parameter_group_family" {
  description = "Redis parameter group family"
  type        = string
  default     = "redis7"
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "redis_automatic_failover" {
  description = "Enable automatic failover for Redis"
  type        = bool
  default     = false
}

# ─────────────────────────────────────────────────────────────
# Networking Configuration
# ─────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnet outbound access"
  type        = bool
  default     = true
}

# ─────────────────────────────────────────────────────────────
# Application Configuration
# ─────────────────────────────────────────────────────────────

variable "container_port" {
  description = "Backend application port"
  type        = number
  default     = 3001
}

variable "health_check_path" {
  description = "Health check endpoint"
  type        = string
  default     = "/api/v1/health"
}

variable "health_check_healthy_threshold" {
  description = "Health check healthy threshold"
  type        = number
  default     = 2
}

variable "health_check_unhealthy_threshold" {
  description = "Health check unhealthy threshold"
  type        = number
  default     = 3
}

variable "health_check_timeout" {
  description = "Health check timeout (seconds)"
  type        = number
  default     = 5
}

variable "health_check_interval" {
  description = "Health check interval (seconds)"
  type        = number
  default     = 30
}

# ─────────────────────────────────────────────────────────────
# Monitoring and Logging
# ─────────────────────────────────────────────────────────────

variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch Logs for ECS"
  type        = bool
  default     = true
}

variable "cloudwatch_log_retention" {
  description = "CloudWatch Logs retention period (days)"
  type        = number
  default     = 7
}

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch Alarms for monitoring"
  type        = bool
  default     = true
}

# ─────────────────────────────────────────────────────────────
# Tags
# ─────────────────────────────────────────────────────────────

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    ManagedBy = "Terraform"
    Project   = "hub-server-side-tracking"
  }
}
