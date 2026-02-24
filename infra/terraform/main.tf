locals {
  prefix = var.project_name
}

resource "random_password" "rds_master" {
  length           = 20
  special          = true
  override_special = "!#$%^&*()-_=+"
}

resource "aws_secretsmanager_secret" "rds_password" {
  name                    = "rds-master-password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "rds_password" {
  secret_id     = aws_secretsmanager_secret.rds_password.id
  secret_string = random_password.rds_master.result
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "${local.prefix}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.prefix}-igw" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "${local.prefix}-public-${count.index + 1}" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]
  tags = { Name = "${local.prefix}-private-${count.index + 1}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${local.prefix}-rt-public" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "${local.prefix}-nat-eip" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.main]
  tags          = { Name = "${local.prefix}-nat" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
  tags = { Name = "${local.prefix}-rt-private" }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "alb" {
  name   = "${local.prefix}-alb-sg"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = var.api_port
    to_port     = var.api_port
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
  tags = { Name = "${local.prefix}-alb-sg" }
}

resource "aws_security_group" "ecs" {
  name   = "${local.prefix}-ecs-sg"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port       = var.api_port
    to_port         = var.api_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.prefix}-ecs-sg" }
}

resource "aws_security_group" "rds" {
  name   = "${local.prefix}-rds-sg"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${local.prefix}-rds-sg" }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.prefix}-api"
  retention_in_days = var.log_retention_days
  tags = { Name = "${local.prefix}-logs" }
}

resource "aws_iam_role" "ecs_execution" {
  name = "${local.prefix}-ecs-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "ReadSecrets"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = [
        "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:meta-capi-credentials*",
        "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:hotmart-webhook-secret*",
        "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:perfectpay-webhook-secret*",
        "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:kiwify-webhook-secret*",
        "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:stripe-webhook-secret*",
        "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:rds-master-password*",
        "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:rds-postgres-connection-string*"
      ]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.prefix}-ecs-task-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_sqs" {
  name = "SQSAndSecretsAccess"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage","sqs:ReceiveMessage","sqs:DeleteMessage","sqs:GetQueueAttributes","sqs:GetQueueUrl"]
        Resource = aws_sqs_queue.dispatch.arn
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = ["arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:*"]
      }
    ]
  })
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id
  tags = { Name = "${local.prefix}-db-subnet-group" }
}

resource "aws_db_parameter_group" "postgres15" {
  name   = "${local.prefix}-pg15-params"
  family = "postgres15"
  parameter {
    name         = "max_connections"
    value        = "100"
    apply_method = "pending-reboot"
  }
  tags = { Name = "${local.prefix}-pg15-params" }
}

resource "aws_db_instance" "postgres" {
  identifier              = "${local.prefix}-db"
  engine                  = "postgres"
  engine_version          = "15"
  instance_class          = var.db_instance_class
  allocated_storage       = var.db_allocated_storage
  storage_type            = "gp2"
  db_name                 = var.db_name
  username                = var.db_username
  password                = random_password.rds_master.result
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  parameter_group_name    = aws_db_parameter_group.postgres15.name
  multi_az                = false
  publicly_accessible     = false
  skip_final_snapshot     = true
  backup_retention_period = var.db_backup_retention
  deletion_protection     = false
  tags = { Name = "${local.prefix}-db" }
}

resource "aws_secretsmanager_secret" "rds_connection_string" {
  name                    = "rds-postgres-connection-string"
  recovery_window_in_days = 0
  depends_on              = [aws_db_instance.postgres]
}

resource "aws_secretsmanager_secret_version" "rds_connection_string" {
  secret_id     = aws_secretsmanager_secret.rds_connection_string.id
  secret_string = "postgres://${var.db_username}:${random_password.rds_master.result}@${aws_db_instance.postgres.address}:5432/${var.db_name}"
}

resource "aws_sqs_queue" "dispatch" {
  name                       = "${local.prefix}-dispatch"
  message_retention_seconds  = var.sqs_message_retention
  visibility_timeout_seconds = var.sqs_visibility_timeout
  receive_wait_time_seconds  = var.sqs_receive_wait_time
  tags = { Name = "${local.prefix}-dispatch" }
}

resource "aws_ecr_repository" "api" {
  name                 = "${local.prefix}-api"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  tags = { Name = "${local.prefix}-api" }
}

resource "aws_ecs_cluster" "main" {
  name = local.prefix
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = { Name = local.prefix }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.prefix}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_cpu
  memory                   = var.ecs_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions = jsonencode([{
    name      = "api"
    image     = var.api_image
    essential = true
    portMappings = [{
      containerPort = var.api_port
      protocol      = "tcp"
    }]
    environment = [
      { name = "NODE_ENV",  value = "production" },
      { name = "LOG_LEVEL", value = "info" },
      { name = "PORT",      value = tostring(var.api_port) }
    ]
    secrets = [
      { name = "DATABASE_URL",            valueFrom = aws_secretsmanager_secret.rds_connection_string.arn },
      { name = "META_CAPI_APP_ID",        valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:meta-capi-credentials:APP_ID::" },
      { name = "META_CAPI_APP_SECRET",    valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:meta-capi-credentials:APP_SECRET::" },
      { name = "META_CAPI_ACCESS_TOKEN",  valueFrom = "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:meta-capi-credentials:ACCESS_TOKEN::" },
      { name = "HOTMART_WEBHOOK_SECRET",    valueFrom = data.aws_secretsmanager_secret.hotmart.arn },
      { name = "PERFECTPAY_WEBHOOK_SECRET", valueFrom = data.aws_secretsmanager_secret.perfectpay.arn },
      { name = "KIWIFY_WEBHOOK_SECRET",     valueFrom = data.aws_secretsmanager_secret.kiwify.arn },
      { name = "STRIPE_WEBHOOK_SECRET",     valueFrom = data.aws_secretsmanager_secret.stripe.arn }
    ]
    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:3001/api/v1/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${local.prefix}-api"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
  tags = { Name = "${local.prefix}-api-task" }
}

resource "aws_lb" "main" {
  name               = "${local.prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  tags = { Name = "${local.prefix}-alb" }
}

resource "aws_lb_target_group" "api" {
  name        = "${local.prefix}-api-tg"
  port        = var.api_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    enabled             = true
    path                = "/api/v1/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
    matcher             = "200"
  }
  tags = { Name = "${local.prefix}-api-tg" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_ecs_service" "api" {
  name                 = "${local.prefix}-api"
  cluster              = aws_ecs_cluster.main.id
  task_definition      = aws_ecs_task_definition.api.arn
  desired_count        = var.ecs_desired_count
  launch_type          = "FARGATE"
  force_new_deployment = true
  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.api_port
  }
  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy_attachment.ecs_execution_managed,
    aws_db_instance.postgres
  ]
  tags = { Name = "${local.prefix}-api-service" }
}

data "aws_secretsmanager_secret" "hotmart" { name = "hotmart-webhook-secret" }
data "aws_secretsmanager_secret" "perfectpay" { name = "perfectpay-webhook-secret" }
data "aws_secretsmanager_secret" "kiwify" { name = "kiwify-webhook-secret" }
data "aws_secretsmanager_secret" "stripe" { name = "stripe-webhook-secret" }
