// Issues #1128, #1129, #1130, #1131 - Security & Integration Tests

#[test]
fn test_partial_cancel_requires_sender_auth() {
  // Issue #1128: recipient auth fails
  let stream = create_stream(sender, recipient, 1000);
  let result = env.invoke_contract_check_auth(
    &stream.contract,
    "partial_cancel",
    vec![&recipient],
  );
  assert_eq!(result, Err(UnauthorizedBySigners));

  // Issue #1128: attacker auth fails
  let result = env.invoke_contract_check_auth(
    &stream.contract,
    "partial_cancel",
    vec![&attacker],
  );
  assert_eq!(result, Err(UnauthorizedBySigners));
}

#[test]
fn test_top_up_requires_sender_auth() {
  // Issue #1129: recipient auth fails
  let stream = create_stream(sender, recipient, 1000);
  let result = env.invoke_contract_check_auth(
    &stream.contract,
    "top_up",
    vec![&recipient],
  );
  assert_eq!(result, Err(UnauthorizedBySigners));

  // Issue #1129: attacker auth fails
  let result = env.invoke_contract_check_auth(
    &stream.contract,
    "top_up",
    vec![&attacker],
  );
  assert_eq!(result, Err(UnauthorizedBySigners));
}

#[test]
fn test_delegate_cannot_transfer_or_cancel() {
  // Issue #1130: Set delegate
  let stream = create_stream(sender, recipient, 1000);
  stream.set_delegate(&delegate);

  // Issue #1130: delegate auth cannot transfer
  let result = env.invoke_contract_check_auth(
    &stream.contract,
    "transfer_stream",
    vec![&delegate],
  );
  assert_eq!(result, Err(UnauthorizedBySigners));

  // Issue #1130: delegate auth cannot cancel
  let result = env.invoke_contract_check_auth(
    &stream.contract,
    "cancel",
    vec![&delegate],
  );
  assert_eq!(result, Err(UnauthorizedBySigners));
}

#[test]
fn test_token_conservation_mixed_operations() {
  // Issue #1131: Token conservation across mixed operations
  let mut rng = rand::thread_rng();
  let mut streams = Vec::new();
  let mut total_deposited = 0i128;
  let mut total_withdrawn = 0i128;
  let mut total_cancelled = 0i128;

  for _ in 0..50 {
    let op = rng.gen_range(0..6);

    match op {
      0 => { // create
        let amount = rng.gen_range(100..10000);
        streams.push(create_stream(sender, recipient, amount));
        total_deposited += amount;
      }
      1 => { // top_up
        if !streams.is_empty() {
          let idx = rng.gen_range(0..streams.len());
          let amount = rng.gen_range(100..1000);
          streams[idx].top_up(amount);
          total_deposited += amount;
        }
      }
      2 => { // withdraw
        if !streams.is_empty() {
          let idx = rng.gen_range(0..streams.len());
          let amount = streams[idx].get_withdrawable();
          streams[idx].withdraw(amount);
          total_withdrawn += amount;
        }
      }
      3 => { // partial_cancel
        if !streams.is_empty() {
          let idx = rng.gen_range(0..streams.len());
          let amount = rng.gen_range(1..100);
          if let Ok(_) = streams[idx].partial_cancel(amount) {
            total_cancelled += amount;
          }
        }
      }
      4 => { // transfer
        if !streams.is_empty() {
          let idx = rng.gen_range(0..streams.len());
          streams[idx].transfer_stream(&new_recipient);
        }
      }
      5 => { // cancel
        if !streams.is_empty() {
          let idx = rng.gen_range(0..streams.len());
          let (refund, _) = streams[idx].cancel();
          total_cancelled += refund;
          streams.remove(idx);
        }
      }
      _ => {}
    }

    // Issue #1131: Assert invariant
    let contract_balance = get_contract_balance();
    let expected = total_deposited - total_withdrawn - total_cancelled;
    assert_eq!(contract_balance, expected);
  }
}
