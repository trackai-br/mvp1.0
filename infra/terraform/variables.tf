variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "aws_profile" {
  type    = string
  default = "account-751702759697"
}
variable "aws_account_id" {
  type    = string
  default = "751702759697"
}
variable "project_name" {
  type    = string
  default = "hub-server-side-tracking"
}
variable "environment" {
  type    = string
  default = "production"
}
variable "created_at" {
  type    = string
  default = "2025-02-24"
}
variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}
variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}
variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.10.0/24", "10.0.11.0/24"]
}
variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}
variable "api_image" {
  type    = string
  default = "751702759697.dkr.ecr.us-east-1.amazonaws.com/hub-server-side-tracking-api:latest"
}
variable "api_port" {
  type    = number
  default = 3001
}
variable "ecs_cpu" {
  type    = number
  default = 256
}
variable "ecs_memory" {
  type    = number
  default = 512
}
variable "ecs_desired_count" {
  type    = number
  default = 1
}
variable "db_name" {
  type    = string
  default = "hub_server_side_tracking"
}
variable "db_username" {
  type    = string
  default = "postgres"
}
variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}
variable "db_allocated_storage" {
  type    = number
  default = 20
}
variable "db_backup_retention" {
  type    = number
  default = 7
}
variable "sqs_message_retention" {
  type    = number
  default = 345600
}
variable "sqs_visibility_timeout" {
  type    = number
  default = 300
}
variable "sqs_receive_wait_time" {
  type    = number
  default = 20
}
variable "log_retention_days" {
  type    = number
  default = 7
}
