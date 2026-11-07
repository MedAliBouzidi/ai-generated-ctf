# Dedicated VPC for VulnLab CTF isolation
resource "aws_vpc" "ctf_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# Internet Gateway for internet egress/ingress
resource "aws_internet_gateway" "ctf_igw" {
  vpc_id = aws_vpc.ctf_vpc.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# Public Subnet in the primary availability zone
resource "aws_subnet" "ctf_public_subnet" {
  vpc_id                  = aws_vpc.ctf_vpc.id
  cidr_block              = var.public_subnet_cidr
  map_public_ip_on_launch = true
  availability_zone       = "${var.aws_region}a"

  tags = {
    Name = "${var.project_name}-public-subnet"
  }
}

# Public Route Table routing 0.0.0.0/0 to the Internet Gateway
resource "aws_route_table" "ctf_public_rt" {
  vpc_id = aws_vpc.ctf_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.ctf_igw.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

# Associate public subnet with the public route table
resource "aws_route_table_association" "ctf_public_rta" {
  subnet_id      = aws_subnet.ctf_public_subnet.id
  route_table_id = aws_route_table.ctf_public_rt.id
}
