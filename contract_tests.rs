// Issues #1124, #1125, #1126, #1127 - partial_cancel tests

#[test]
fn test_partial_cancel_zero_amount() {
  // Issue #1125: zero amount
  let stream = create_stream(1000, 100);
  assert_eq!(stream.try_partial_cancel(0), Err(InvalidAmount));
}

#[test]
fn test_partial_cancel_negative_amount() {
  // Issue #1125: negative amount
  let stream = create_stream(1000, 100);
  assert_eq!(stream.try_partial_cancel(-1), Err(InvalidAmount));
}

#[test]
fn test_partial_cancel_after_end_time() {
  // Issue #1124: after end_time returns StreamEnded
  let stream = create_stream(end_time: 1000, 100);
  advance_ledger(2000);
  assert_eq!(stream.try_partial_cancel(100), Err(StreamEnded));
}

#[test]
fn test_partial_cancel_before_cliff() {
  // Issue #1126: before cliff only shrinks linear portion
  let stream = create_stream(
    cliff_amount: 500,
    linear_amount: 1000,
    cliff_time: 2000,
  );

  stream.try_partial_cancel(200).unwrap();

  assert_eq!(stream.cliff_amount, 500); // unchanged
  assert_eq!(stream.linear_amount, 800); // reduced by 200

  advance_ledger(2000); // reach cliff
  assert_eq!(stream.get_withdrawable(), 500); // cliff_amount

  advance_ledger(5000); // end
  assert_eq!(stream.get_withdrawable(), 1300); // 500 + 800
}

#[test]
fn test_partial_cancel_emits_event() {
  // Issue #1127: PartialCancelEvent published
  let stream = create_stream(1000, 100);

  stream.try_partial_cancel(300).unwrap();

  let event = get_emitted_event::<PartialCancelEvent>();
  assert_eq!(event.amount_refunded, 300);
  assert_eq!(event.new_deposited_amount, 700);
  assert_eq!(event.sender, stream.sender);
  assert_eq!(event.recipient, stream.recipient);
}
