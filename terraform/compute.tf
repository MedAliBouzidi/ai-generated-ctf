# Fetch official Ubuntu 24.04 LTS (Noble Numbat) AMI if no specific AMI ID is provided
data "aws_ami" "ubuntu" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  ami_id = var.ami_id != "" ? var.ami_id : data.aws_ami.ubuntu[0].id
  # AWS Academy attaches "LabRole" via the "LabInstanceProfile" instance profile.
  # If the user sets "LabRole", map it automatically to "LabInstanceProfile".
  iam_instance_profile = var.use_lab_role ? (
    var.existing_iam_instance_profile == "LabRole" ? "LabInstanceProfile" : var.existing_iam_instance_profile
  ) : aws_iam_instance_profile.ctf_instance_profile[0].name
}

# VulnLab CTF EC2 Host Instance
resource "aws_instance" "ctf_server" {
  ami                    = local.ami_id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.ctf_public_subnet.id
  vpc_security_group_ids = [aws_security_group.ctf_sg.id]
  iam_instance_profile   = local.iam_instance_profile
  key_name               = var.key_name != "" ? var.key_name : null

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name = "${var.project_name}-root-volume"
    }
  }

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    git_repo_url   = var.git_repo_url
    git_branch     = var.git_branch
    ctf_difficulty = var.ctf_difficulty
  })

  tags = {
    Name = "${var.project_name}-server"
  }
}
