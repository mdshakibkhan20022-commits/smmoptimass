const KNOWN: Array<[string, string]> = [
  ['Insufficient balance', 'Your balance is too low for this order. Please add funds first.'],
  ['Quantity out of range', 'Quantity is outside the allowed minimum and maximum for this service.'],
  ['Invalid link', 'Please enter a valid link.'],
  ['Service unavailable', 'This service is currently unavailable.'],
  ['Account not active', 'Your account is suspended. Please contact support.'],
  ['Invalid amount', 'Please enter a valid amount.'],
  ['Invalid transaction ID', 'Please enter a valid bKash transaction ID.'],
  ['Invalid sender number', 'Please enter the bKash number you paid from.'],
  ['Below minimum deposit', 'This amount is below the minimum deposit.'],
  ['Too many pending payments', 'You already have several payments waiting for review.'],
  ['payments_bkash_trx_key', 'This transaction ID has already been submitted.'],
  ['Refill not available', 'Refill is not available for this order.'],
  ['Cancel not available', 'This order can no longer be canceled.'],
  ['Minimum transfer', 'You need at least $1 in earnings to transfer.'],
  ['Payment already reviewed', 'This payment has already been reviewed.'],
  ['cannot change your own account', 'You cannot change your own role or status.'],
  ['Not authorized', 'You do not have permission to do that.'],
  ['User already registered', 'That username or email is already in use.'],
  ['Database error saving new user', 'That username or email is already in use.'],
  ['Password should be', 'Password must be at least 6 characters.'],
  ['rate limit', 'Too many attempts. Please wait a minute and try again.'],
  ['Incorrect username or password', 'Incorrect username or password.'],
  ['Provider', ''],
];

export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.') {
  const raw = (err as { message?: string })?.message ?? '';
  console.error(err);
  for (const [needle, msg] of KNOWN) {
    if (raw.toLowerCase().includes(needle.toLowerCase())) return msg || raw;
  }
  return fallback;
}
