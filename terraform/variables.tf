variable "aws_region" {
  description = "AWS region where resources will be provisioned"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name prefix for resource naming and tagging"
  type        = string
  default     = "vulnlab-ctf"
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, prod, lab)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the dedicated VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "instance_type" {
  description = "EC2 instance type (t3.medium recommended for running 7 Docker containers: 2 vCPU, 4GB RAM)"
  type        = string
  default     = "t3.medium"
}

variable "ami_id" {
  description = "Optional specific AMI ID. If empty, the latest official Ubuntu 24.04 LTS AMI is used."
  type        = string
  default     = ""
}

variable "key_name" {
  description = "Optional EC2 SSH Key Pair name to attach for SSH access"
  type        = string
  default     = ""
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access CTF applications and scoreboard. Restrict to your IP for safety."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_cidr_blocks" {
  description = "CIDR blocks allowed to connect via SSH (port 22)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "root_volume_size" {
  description = "Root EBS volume size in GB (30GB+ recommended for Docker images and container build caches)"
  type        = number
  default     = 30
}

variable "git_repo_url" {
  description = "Git repository URL containing the VulnLab CTF codebase"
  type        = string
  default     = "https://github.com/MedAliBouzidi/ai-generated-ctf.git"
}

variable "git_branch" {
  description = "Git branch to clone and deploy"
  type        = string
  default     = "main"
}

variable "ctf_difficulty" {
  description = "Initial CTF difficulty level (easy, medium, hard)"
  type        = string
  default     = "easy"

  validation {
    condition     = contains(["easy", "medium", "hard"], var.ctf_difficulty)
    error_message = "Difficulty must be one of: 'easy', 'medium', 'hard'."
  }
}
