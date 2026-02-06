import json
import os
import uuid
import boto3
from datetime import datetime
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Content-Type': 'application/json'
}


def handler(event, context):
    method = event['httpMethod']
    user_sub = extract_user_sub(event)

    if not user_sub:
        return response(401, {'message': 'Unauthorized: user identity not found'})

    try:
        if method == 'POST':
            return create_job(user_sub, json.loads(event['body']))
        elif method == 'GET':
            return list_jobs(user_sub)
        elif method == 'PUT':
            return update_job(user_sub, json.loads(event['body']))
        else:
            return response(405, {'message': f'Method {method} not allowed'})
    except Exception as e:
        print(f"Error: {e}")
        return response(500, {'message': 'Internal server error'})


def extract_user_sub(event):
    """Extract user_sub from Cognito JWT authorizer claims."""
    try:
        return event['requestContext']['authorizer']['claims']['sub']
    except (KeyError, TypeError):
        return None


def create_job(user_sub, body):
    created_at = datetime.utcnow().isoformat() + 'Z'
    item = {
        'user_sub': user_sub,
        'created_at': created_at,
        'job_id': str(uuid.uuid4()),
        'filename': body['filename'],
        'format': body['format'],
        'status': 'processing',
        's3_bucket': body['s3_bucket'],
        's3_upload_key': body['s3_upload_key'],
        'page_count': body.get('page_count', 0),
    }
    table.put_item(Item=item)
    return response(200, item)


def list_jobs(user_sub):
    result = table.query(
        KeyConditionExpression=Key('user_sub').eq(user_sub),
        ScanIndexForward=False  # newest first
    )
    return response(200, {'jobs': result['Items']})


def update_job(user_sub, body):
    created_at = body['created_at']
    update_expr = 'SET #s = :status'
    expr_names = {'#s': 'status'}
    expr_values = {':status': body['status']}

    if body.get('s3_result_key'):
        update_expr += ', s3_result_key = :result_key'
        expr_values[':result_key'] = body['s3_result_key']

    if body['status'] == 'complete':
        update_expr += ', completed_at = :completed_at'
        expr_values[':completed_at'] = datetime.utcnow().isoformat() + 'Z'

    table.update_item(
        Key={'user_sub': user_sub, 'created_at': created_at},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )
    return response(200, {'message': 'Job updated'})


def response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, default=str)
    }
