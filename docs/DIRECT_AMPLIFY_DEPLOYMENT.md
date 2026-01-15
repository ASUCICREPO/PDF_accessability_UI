# Direct Amplify Deployment Guide

## Overview

The `deploy-amplify-direct.sh` script allows you to deploy any local branch directly to Amplify without using CodeBuild or pushing to GitHub. This is perfect for:

- Testing local changes before committing
- Deploying custom demo branches (like the UB demo)
- Rapid iteration during development
- Keeping the main branch connected to GitHub while deploying other branches

## How It Works

The script automates the entire deployment process:

1. **Retrieves Configuration*