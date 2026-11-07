# IAM Role for EC2 Instance allowing Systems Manager (SSM) access
resource "aws_iam_role" "ctf_ec2_role" {
  name = "${var.project_name}-ec2-role"

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
  role       = aws_iam_role.ctf_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Instance Profile to attach the IAM role to the EC2 instance
resource "aws_iam_instance_profile" "ctf_instance_profile" {
  name = "${var.project_name}-instance-profile"
  role = aws_iam_role.ctf_ec2_role.name

  tags = {
    Name = "${var.project_name}-instance-profile"
  }
}
