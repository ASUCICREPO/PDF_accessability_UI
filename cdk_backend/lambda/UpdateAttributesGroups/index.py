import json
import os
import boto3
import time
from botocore.exceptions import ClientError

# Initialize Cognito Identity Provider client
cognito_client = boto3.client('cognito-idp')

# ======== Configuration from Environment ========
###########################################
USER_POOL_ID = os.environ.get('USER_POOL_ID', '')  # Set via CDK environment variable

# For manual invocation only
GROUP_NAME = 'AdminUsers'  # Example group name for manual usage
UPDATE_ALL = True  # True | False
USER_SUB = 'USERSUB'  # Required only if UPDATE_ALL is False

# ---- Example Group Limits & Precedence ----
GROUP_LIMITS = {
    'DefaultUsers': {
        # 'custom:first_sign_in': 'true',
        # 'custom:total_files_uploaded': '0',  # optionally reset
        'custom:max_files_allowed': '8',
        'custom:max_pages_allowed': '10',
        'custom:max_size_allowed_MB': '25'
    },
    'AmazonUsers': {
        # 'custom:first_sign_in': 'true',
        # 'custom:total_files_uploaded': '0',  # optionally reset
        'custom:max_files_allowed': '15',
        'custom:max_pages_allowed': '10',
        'custom:max_size_allowed_MB': '25'
    },
    'AdminUsers': {
        # 'custom:first_sign_in': 'true',
        # 'custom:total_files_uploaded': '0',  # optionally reset
        'custom:max_files_allowed': '100',
        'custom:max_pages_allowed': '2500',
        'custom:max_size_allowed_MB': '1000'
    }
}

# Define a precedence: The first match in this list is considered "highest" precedence.
GROUP_PRECEDENCE = ['AdminUsers', 'AmazonUsers', 'DefaultUsers']

#XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
# Do not change below for normal usage
###########################################
MAX_RETRIES = 5  # Maximum number of retries for throttling
BASE_DELAY = 1   # Base delay in seconds for exponential backoff

def handler(event, context):
    """
    AWS Lambda function that either:
        1) Is triggered by EventBridge for group changes (AdminAddUserToGroup / AdminRemoveUserFromGroup).
        2) Is manually invoked (e.g., with the Hardcoded Configuration above).
    
    Depending on invocation type, this function:
        - Fetches the user(s)
        - Determines which group(s) the user(s) belong to
        - Applies the custom attribute limits based on highest-precedence group
    """
    try:
        # Validate USER_POOL_ID is configured
        if not USER_POOL_ID:
            print("[ERROR] USER_POOL_ID environment variable is not set.")
            return format_response(500, "Server configuration error: USER_POOL_ID not set.")

        # 1) Check if this is likely an EventBridge (CloudTrail) invocation
        if is_eventbridge_invocation(event):
            print("[INFO] EventBridge invocation detected.")
            print(event)
            return handle_eventbridge_invocation(event)
        
        # 2) Otherwise, assume manual invocation
        print("[INFO] Manual invocation detected.")
        return handle_manual_invocation()

    except Exception as e:
        print(f"Unhandled exception: {str(e)}")
        return format_response(500, "Internal server error.")

# ---------------------------------------------------------------------
#                      Handle Manual Invocation
# ---------------------------------------------------------------------
def handle_manual_invocation():
    """
    Handle the logic that was originally in your Lambda if you want 
    to run it manually for a specific group or user(s).
    """
    # Validate parameters
    if not isinstance(UPDATE_ALL, bool):
        return format_response(400, "Parameter 'UPDATE_ALL' must be a boolean.")

    if not UPDATE_ALL and not USER_SUB:
        return format_response(400, "Parameter 'USER_SUB' is required when 'UPDATE_ALL' is False.")

    # Determine the list of users to update
    if UPDATE_ALL:
        users_to_update = get_all_users_in_group_with_retry(GROUP_NAME)
        if users_to_update is None:
            return format_response(500, f"Failed to retrieve users from group '{GROUP_NAME}'.")
        if not users_to_update:
            return format_response(200, f"No users found in group '{GROUP_NAME}' to update.")
        print(f"Found {len(users_to_update)} users in group '{GROUP_NAME}' for update.")
    else:
        # Update a specific user
        user = get_user_by_sub_with_retry(USER_SUB)
        if user is None:
            return format_response(404, f"User with sub '{USER_SUB}' not found.")

        user_groups = get_user_groups_with_retry(USER_SUB)
        if user_groups is None:
            return format_response(500, f"Failed to retrieve user groups for sub '{USER_SUB}'.")
        if GROUP_NAME not in user_groups:
            return format_response(400, f"User with sub '{USER_SUB}' is not a member of group '{GROUP_NAME}'.")
        users_to_update = [USER_SUB]
        print(f"User '{USER_SUB}' confirmed in group '{GROUP_NAME}' for update.")

    # Update each user based on the group's configured limits.
    # For manual usage, we *know* the user(s) are in GROUP_NAME, 
    # so pick that group's dictionary or fallback to default.
    if GROUP_NAME in GROUP_LIMITS:
        attributes_to_apply = GROUP_LIMITS[GROUP_NAME]
    else:
        attributes_to_apply = GROUP_LIMITS['DefaultUsers']  # fallback

    updated_users = []
    failed_updates = []

    for sub in users_to_update:
        success = update_user_attributes_with_retry(sub, attributes_to_apply)
        if success:
            updated_users.append(sub)
            print(f"Successfully updated user '{sub}'.")
        else:
            failed_updates.append(sub)
            print(f"Failed to update user '{sub}'.")

    # Prepare the response
    response_message = {
        "mode": "Update_ALL" if UPDATE_ALL else "Specific User Updated",
        "message": "User attribute updates completed.",
        "total_users_processed": len(users_to_update),
        "successful_updates": len(updated_users),
        "failed_updates": failed_updates
    }

    return format_response(200, response_message)

# ---------------------------------------------------------------------
#                  Handle EventBridge Invocation
# ---------------------------------------------------------------------
def handle_eventbridge_invocation(event):
    """
    Handle logic specific to receiving an EventBridge (CloudTrail) event
    for a Cognito group membership change, such as AdminAddUserToGroup 
    or AdminRemoveUserFromGroup.
    """
    detail = event.get('detail', {})
    event_name = detail.get('eventName')
    request_params = detail.get('requestParameters', {})

    user_pool_id = request_params.get('userPoolId')
    username_or_sub = detail.get('additionalEventData', {}).get('sub')  # Typically the 'Username' in Cognito is the 'sub'.

    # Safety checks
    if not user_pool_id or not username_or_sub:
        return format_response(400, "Missing userPoolId or username in EventBridge detail.")

    # Optionally verify that the userPoolId matches your expected pool
    # If it differs, you may choose to skip or handle differently
    if user_pool_id != USER_POOL_ID:
        return format_response(200, "Event is for a different user pool; skipping.")

    # 1) Check if the user exists (still might not, if e.g. the event is out of sync)
    user = get_user_by_sub_with_retry(username_or_sub)
    if user is None:
        return format_response(404, f"User with sub/username '{username_or_sub}' not found in user pool.")

    # 2) Gather the user's current groups after the add/remove operation
    user_groups = get_user_groups_with_retry(username_or_sub)
    if user_groups is None:
        return format_response(500, f"Failed to retrieve user groups for sub '{username_or_sub}'.")

    # 3) Determine which group has the highest precedence
    highest_group = get_highest_precedence_group(user_groups)

    # 4) Fetch the attribute set for that group. If none matched, fallback to 'DEFAULT_GROUP'
    attributes_to_apply = GROUP_LIMITS.get(highest_group, GROUP_LIMITS['DefaultUsers'])

    # 5) Update the user's attributes
    success = update_user_attributes_with_retry(username_or_sub, attributes_to_apply)

    if success:
        message = f"[{event_name}] Succeeded updating user '{username_or_sub}' with group '{highest_group}' attributes."
        print(message)
        return format_response(200, message)
    else:
        message = f"[{event_name}] Failed to update user '{username_or_sub}' with group '{highest_group}' attributes."
        print(message)
        return format_response(500, message)


# ---------------------------------------------------------------------
#                   Utility / Helper Functions
# ---------------------------------------------------------------------
def is_eventbridge_invocation(event):
    """
    Simple helper to detect if the event is from EventBridge (CloudTrail).
    Adjust your logic as needed (e.g., look at 'source', 'detailType', etc.).
    """
    return (
        event.get('source') == 'aws.cognito-idp'
        and event.get('detail-type') == 'AWS API Call via CloudTrail'
        and 'detail' in event
    )

def format_response(status_code, body):
    """
    Formats the response for API Gateway or Lambda console.
    """
    if isinstance(body, dict):
        body = json.dumps(body)
    return {
        "statusCode": status_code,
        "body": body
    }

def get_user_sub(user):
    """
    Extracts the 'sub' attribute from a Cognito user object.
    """
    attributes = user.get('UserAttributes', []) or user.get('Attributes', [])
    for attribute in attributes:
        if attribute['Name'] == 'sub':
            return attribute['Value']
    return None

def get_all_users_in_group_with_retry(group_name):
    """
    Retrieves all users in a specified Cognito user group with exponential backoff.
    """
    users = []
    next_token = None
    retries = 0

    while True:
        try:
            params = {
                'UserPoolId': USER_POOL_ID,
                'GroupName': group_name,
                'Limit': 60  # Max allowed by Cognito per request
            }
            if next_token:
                params['NextToken'] = next_token

            response = cognito_client.list_users_in_group(**params)
            batch_users = [get_user_sub(u) for u in response.get('Users', []) if u]
            batch_users = [sub for sub in batch_users if sub]  # Filter out None
            users.extend(batch_users)

            next_token = response.get('NextToken')
            if not next_token:
                break

        except ClientError as e:
            if e.response['Error']['Code'] in ['TooManyRequestsException', 'ThrottlingException']:
                if retries < MAX_RETRIES:
                    delay = BASE_DELAY * (2 ** retries)
                    print(f"Throttled. Retrying in {delay} seconds...")
                    time.sleep(delay)
                    retries += 1
                    continue
                else:
                    print("Max retries reached. Exiting.")
                    return None
            else:
                print(f"ClientError: {e}")
                return None
        except Exception as e:
            print(f"Unexpected error: {e}")
            return None

    return users

def get_user_by_sub_with_retry(user_sub):
    """
    Retrieves a Cognito user by their 'sub' identifier with exponential backoff.
    """
    retries = 0

    while True:
        try:
            response = cognito_client.admin_get_user(
                UserPoolId=USER_POOL_ID,
                Username=user_sub
            )
            return response
        except cognito_client.exceptions.UserNotFoundException:
            print(f"User with sub '{user_sub}' not found.")
            return None
        except ClientError as e:
            if e.response['Error']['Code'] in ['TooManyRequestsException', 'ThrottlingException']:
                if retries < MAX_RETRIES:
                    delay = BASE_DELAY * (2 ** retries)
                    print(f"Throttled. Retrying in {delay} seconds...")
                    time.sleep(delay)
                    retries += 1
                    continue
                else:
                    print("Max retries reached. Exiting.")
                    return None
            else:
                print(f"ClientError: {e}")
                return None
        except Exception as e:
            print(f"Unexpected error: {e}")
            return None

def get_user_groups_with_retry(user_sub):
    """
    Retrieves all groups a user belongs to with exponential backoff on throttling.
    """
    retries = 0

    while True:
        try:
            response = cognito_client.admin_list_groups_for_user(
                UserPoolId=USER_POOL_ID,
                Username=user_sub
            )
            groups = [group['GroupName'] for group in response.get('Groups', [])]
            return groups
        except ClientError as e:
            if e.response['Error']['Code'] in ['TooManyRequestsException', 'ThrottlingException']:
                if retries < MAX_RETRIES:
                    delay = BASE_DELAY * (2 ** retries)
                    print(f"Throttled. Retrying in {delay} seconds...")
                    time.sleep(delay)
                    retries += 1
                    continue
                else:
                    print("Max retries reached. Exiting.")
                    return None
            else:
                print(f"ClientError: {e}")
                return None
        except Exception as e:
            print(f"Unexpected error: {e}")
            return None

def update_user_attributes_with_retry(user_sub, attributes):
    """
    Updates custom attributes for a specified Cognito user with exponential backoff on throttling.
    """
    retries = 0
    user_attributes = [{'Name': k, 'Value': v} for k, v in attributes.items()]

    while True:
        try:
            cognito_client.admin_update_user_attributes(
                UserPoolId=USER_POOL_ID,
                Username=user_sub,
                UserAttributes=user_attributes
            )
            return True
        except ClientError as e:
            if e.response['Error']['Code'] in ['TooManyRequestsException', 'ThrottlingException']:
                if retries < MAX_RETRIES:
                    delay = BASE_DELAY * (2 ** retries)
                    print(f"Throttled. Retrying in {delay} seconds...")
                    time.sleep(delay)
                    retries += 1
                    continue
                else:
                    print(f"Max retries reached while updating user '{user_sub}'.")
                    return False
            else:
                print(f"ClientError while updating user '{user_sub}': {e}")
                return False
        except Exception as e:
            print(f"Unexpected error while updating user '{user_sub}': {e}")
            return False

def get_highest_precedence_group(user_groups):
    """
    Given a list of group names, returns the group that appears first
    in GROUP_PRECEDENCE. If none found, default to 'DefaultUsers'.
    """
    for group in GROUP_PRECEDENCE:
        if group in user_groups:
            return group
    # Fallback if none are in the precedence list
    return 'DefaultUsers'
