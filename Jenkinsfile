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
                bat 'docker build -t thashmikax/chatapplication-frontend:%BUILD_NUMBER% .'
            }
        }
        stage('Login to Docker Hub') {
            steps {
                withCredentials([string(credentialsId: 'dockerhub-pass', variable: 'jenkins-dockerhub-pass')]) {
                    script {
                        bat "docker login -u thashmikax -p %jenkins-dockerhub-pass%"
                    }
                }
            }
        }
        stage('Push Image') {
            steps {
                bat 'docker push thashmikax/chatapplication-frontend:%BUILD_NUMBER%'
            }
        }
    }
    post {
        always {
            bat 'docker logout'
        }
    }
}