pipeline {
    agent any 
    
    stages {
        stage('SCM Checkout') {
            steps {
                retry(3) {
                    git branch: 'main', url: 'https://github.com/ThashmikaX/chatapplication-frontend'
                }
            }
        }
        
        stage('Build Docker Image') {
            steps {  
                bat 'docker build -t thashmikax/chatapplication-frontend:latest .'
            }
        }
        
        stage('Login to Docker Hub') {
            steps {
                withCredentials([string(credentialsId: 'dockerhub-pass', variable: 'jenkins_dockerhub_pass')]) {
                    script {
                        bat "docker login -u thashmikax -p %jenkins_dockerhub_pass%"
                    }
                }
            }
        }
        
        stage('Push Image') {
            steps {
                bat 'docker push thashmikax/chatapplication-frontend:latest'
            }
        }

        stage('Check and Install Docker on EC2') {
            steps {
                script {
                    sshagent(['aws_ec2_ssh']) {
                        bat '''
                            ssh -o StrictHostKeyChecking=no ubuntu@13.51.162.118 ^
                            "if ! command -v docker &> /dev/null; then ^
                                echo 'Docker is not installed. Installing...'; ^
                                sudo apt update && sudo apt install -y docker.io; ^
                                sudo systemctl start docker; ^
                                sudo systemctl enable docker; ^
                                sudo usermod -aG docker ubuntu; ^
                            else ^
                                echo 'Docker is already installed on EC2.'; ^
                                docker --version; ^
                            fi"
                        '''
                    }
                }
            }
        }
        
        stage('Deploy to EC2') {
            steps {
                script {
                    sshagent(['aws_ec2_ssh']) {
                        bat '''
                            ssh -o StrictHostKeyChecking=no ubuntu@13.51.162.118 ^
                            "docker pull thashmikax/chatapplication-frontend:latest && ^
                            docker stop chatapp_frontend || true && ^
                            docker rm chatapp_frontend || true && ^
                            docker run -d --name chatapp_frontend -p 5000:80 thashmikax/chatapplication-frontend:latest"
                        '''
                    }
                }
            }
        }
    }
    post {
        always {
            bat 'docker logout'
        }
    }
}
