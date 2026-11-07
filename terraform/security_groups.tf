resource "aws_security_group" "ctf_sg" {
  name        = "${var.project_name}-sg"
  description = "Security group for VulnLab CTF EC2 host and application ports"
  vpc_id      = aws_vpc.ctf_vpc.id

  # SSH (Port 22)
  ingress {
    description = "SSH Remote Access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_cidr_blocks
  }

  # HTTP (Port 80) - Nginx Landing Hub & Scoreboard Proxy
  ingress {
    description = "HTTP Portal and Scoreboard Proxy"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # HTTPS (Port 443)
  ingress {
    description = "HTTPS Secure Traffic"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # Scoreboard (Port 8000)
  ingress {
    description = "Scoreboard Web UI and API"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # App 1: Blog SQLi (Port 8001)
  ingress {
    description = "Challenge: Blog SQLi"
    from_port   = 8001
    to_port     = 8001
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # App 2: Notes IDOR (Port 8002)
  ingress {
    description = "Challenge: Notes IDOR"
    from_port   = 8002
    to_port     = 8002
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # App 3: File Share (Port 8003)
  ingress {
    description = "Challenge: File Share"
    from_port   = 8003
    to_port     = 8003
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # App 4: Shop Auth (Port 8004)
  ingress {
    description = "Challenge: Shop Auth"
    from_port   = 8004
    to_port     = 8004
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # App 5: Ping Tool (Port 8005)
  ingress {
    description = "Challenge: Ping Tool"
    from_port   = 8005
    to_port     = 8005
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  # Egress: Allow all outbound connections (required for apt, docker pull, git clone)
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-sg"
  }
}
