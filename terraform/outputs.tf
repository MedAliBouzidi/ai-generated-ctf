output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.ctf_server.id
}

output "public_ip" {
  description = "Public IPv4 address of the VulnLab CTF instance"
  value       = aws_instance.ctf_server.public_ip
}

output "public_dns" {
  description = "Public DNS name of the VulnLab CTF instance"
  value       = aws_instance.ctf_server.public_dns
}

output "portal_url" {
  description = "CTF Main Portal (Scoreboard Reverse Proxy on Port 80)"
  value       = "http://${aws_instance.ctf_server.public_ip}"
}

output "scoreboard_url" {
  description = "Direct Scoreboard URL (Port 8000)"
  value       = "http://${aws_instance.ctf_server.public_ip}:8000"
}

output "blog_sqli_url" {
  description = "Challenge 1: Blog SQLi URL (Port 8001)"
  value       = "http://${aws_instance.ctf_server.public_ip}:8001"
}

output "notes_idor_url" {
  description = "Challenge 2: Notes IDOR URL (Port 8002)"
  value       = "http://${aws_instance.ctf_server.public_ip}:8002"
}

output "file_share_url" {
  description = "Challenge 3: File Share URL (Port 8003)"
  value       = "http://${aws_instance.ctf_server.public_ip}:8003"
}

output "shop_auth_url" {
  description = "Challenge 4: Shop Auth URL (Port 8004)"
  value       = "http://${aws_instance.ctf_server.public_ip}:8004"
}

output "ping_tool_url" {
  description = "Challenge 5: Ping Tool URL (Port 8005)"
  value       = "http://${aws_instance.ctf_server.public_ip}:8005"
}

output "service_urls" {
  description = "Dictionary of all CTF service URLs"
  value = {
    "Scoreboard (Port 80)"   = "http://${aws_instance.ctf_server.public_ip}"
    "Scoreboard (Port 8000)" = "http://${aws_instance.ctf_server.public_ip}:8000"
    "Blog SQLi (Port 8001)"  = "http://${aws_instance.ctf_server.public_ip}:8001"
    "Notes IDOR (Port 8002)" = "http://${aws_instance.ctf_server.public_ip}:8002"
    "File Share (Port 8003)" = "http://${aws_instance.ctf_server.public_ip}:8003"
    "Shop Auth (Port 8004)"  = "http://${aws_instance.ctf_server.public_ip}:8004"
    "Ping Tool (Port 8005)"  = "http://${aws_instance.ctf_server.public_ip}:8005"
  }
}

output "ssh_command" {
  description = "Command to connect via SSH (if key_name was specified)"
  value       = var.key_name != "" ? "ssh -i <path-to-${var.key_name}.pem> ubuntu@${aws_instance.ctf_server.public_ip}" : "SSH key not configured. Use AWS SSM Session Manager."
}

output "ssm_command" {
  description = "Command to connect via AWS SSM Session Manager (no SSH key required)"
  value       = "aws ssm start-session --target ${aws_instance.ctf_server.id}"
}

output "deployment_summary" {
  description = "Quick reference summary of the deployed CTF environment"
  value       = <<-EOT

  ======================================================================
    VULNLAB CTF - AWS DEPLOYMENT SUMMARY
  ======================================================================
    EC2 Instance ID : ${aws_instance.ctf_server.id}
    Public IPv4     : ${aws_instance.ctf_server.public_ip}
    Public DNS      : ${aws_instance.ctf_server.public_dns}
  ----------------------------------------------------------------------
    SERVICE ACCESS URLS:
  ----------------------------------------------------------------------
    CTF Portal / UI : http://${aws_instance.ctf_server.public_ip}
    Scoreboard      : http://${aws_instance.ctf_server.public_ip}:8000
    Blog SQLi       : http://${aws_instance.ctf_server.public_ip}:8001
    Notes IDOR      : http://${aws_instance.ctf_server.public_ip}:8002
    File Share      : http://${aws_instance.ctf_server.public_ip}:8003
    Shop Auth       : http://${aws_instance.ctf_server.public_ip}:8004
    Ping Tool       : http://${aws_instance.ctf_server.public_ip}:8005
  ----------------------------------------------------------------------
    NOTE: Initial container builds take approximately 2-3 minutes.
    Check cloud-init bootstrap log on the instance:
      tail -f /var/log/vulnlab-user-data.log
  ======================================================================
  EOT
}
