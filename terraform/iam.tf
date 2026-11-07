# ==============================================================================
# IAM Configuration for VulnLab CTF EC2 Host
# ==============================================================================
# In AWS Academy / Vocareum Learner Labs, students lack iam:CreateRole permissions.
# By default (var.use_lab_role = true), Terraform does not create any IAM role or
# instance profile, instead using the pre-existing "LabRole" via "LabInstanceProfile".
#
# If running in a regular AWS account, set var.use_lab_role = false to provision
# a dedicated least-privilege IAM role and SSM instance profile.
# ==============================================================================

# IAM Role for EC2 Instance allowing Systems Manager (SSM) access (Standard AWS accounts)
resource "aws_iam_role" "ctf_ec2_role" {
  count = var.use_lab_role ? 0 : 1
  name  = "${var.project_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ec2-role"
  }
}

# Attach AWS managed policy for SSM Session Manager
resource "aws_iam_role_policy_attachment" "ctf_ssm_policy" {
  count      = var.use_lab_role ? 0 : 1
  role       = aws_iam_role.ctf_ec2_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Instance Profile to attach the IAM role to the EC2 instance
resource "aws_iam_instance_profile" "ctf_instance_profile" {
  count = var.use_lab_role ? 0 : 1
  name  = "${var.project_name}-instance-profile"
  role  = aws_iam_role.ctf_ec2_role[0].name

  tags = {
    Name = "${var.project_name}-instance-profile"
  }
}
