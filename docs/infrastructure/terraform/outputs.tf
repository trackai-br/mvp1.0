output "ecr_repository_url" {
  description = "ECR repository URL for pushing Docker images"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_repository_name" {
  description = "ECR repository name"
  value       = aws_ecr_repository.api.name
}

output "ecs_cluster_name" {
  description = "ECS cluster name (use in GitHub Secrets as ECS_CLUSTER)"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name (use in GitHub Secrets as ECS_SERVICE)"
  value       = aws_ecs_service.app.name
}

output "ecs_task_definition_family" {
  description = "ECS task definition family (use in GitHub Secrets as ECS_TASK_DEFINITION)"
  value       = aws_ecs_task_definition.app.family
}

output "rds_endpoint" {
  description = "RDS database endpoint (host only, without port)"
  value       = split(":", aws_db_instance.main.endpoint)[0]
}

output "rds_database_name" {
  description = "RDS database name"
  value       = aws_db_instance.main.db_name
}

output "rds_master_username" {
  description = "RDS master username"
  value       = aws_db_instance.main.username
  sensitive   = true
}

# output "redis_endpoint" {
#   description = "Redis cluster endpoint"
#   value       = aws_elasticache_cluster.main.cache_nodes[0].address
# }

# output "redis_port" {
#   description = "Redis port"
#   value       = aws_elasticache_cluster.main.port
# }

# output "redis_connection_simple" {
#   description = "Redis connection string (simple, no auth)"
#   value       = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:${aws_elasticache_cluster.main.port}/0"
# }

output "alb_dns_name" {
  description = "Application Load Balancer DNS name (use for Route 53)"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "Application Load Balancer ARN"
  value       = aws_lb.main.arn
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}

output "ecs_security_group_id" {
  description = "ECS security group ID"
  value       = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "redis_security_group_id" {
  description = "Redis security group ID"
  value       = aws_security_group.redis.id
}

output "alb_security_group_id" {
  description = "ALB security group ID"
  value       = aws_security_group.alb.id
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "setup_summary" {
  description = "Summary of infrastructure setup"
  value = {
    environment = var.environment
    region      = var.aws_region
    app_name    = var.app_name

    docker_push_command = "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.api.repository_url}"

    github_secrets = {
      AWS_REGION            = var.aws_region
      ECR_REPOSITORY        = aws_ecr_repository.api.name
      ECS_CLUSTER           = aws_ecs_cluster.main.name
      ECS_SERVICE           = aws_ecs_service.app.name
      ECS_TASK_DEFINITION   = aws_ecs_task_definition.app.family
    }

    database_connection = "postgresql://${aws_db_instance.main.username}:PASSWORD@${split(":", aws_db_instance.main.endpoint)[0]}:5432/${aws_db_instance.main.db_name}"
    redis_connection    = "Use Upstash Redis (https://upstash.com) — free tier available"

    api_endpoint = "http://${aws_lb.main.dns_name}"
  }
  sensitive = true
}
