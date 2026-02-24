output "alb_dns_name" {
  value = "http://${aws_lb.main.dns_name}"
}
output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}
output "rds_endpoint" {
  value = "${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}"
}
output "sqs_queue_url" {
  value = aws_sqs_queue.dispatch.url
}
output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}
output "ecs_service_name" {
  value = aws_ecs_service.api.name
}
