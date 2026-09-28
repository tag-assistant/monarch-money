// The current account/API accepts only this stable minimal list shape. Keep
// richer paycheck fields out until an exact live operation is captured and
// verified; guessing field names turns an otherwise useful read into HTTP 400.
export const PAYCHECKS_LIST_QUERY = `query GetPaychecks {
  paychecks {
    id
    __typename
  }
}`;

export const PAYCHECKS_SUMMARY_QUERY = `query GetPaychecksSummary {
  paychecksSummary {
    count
    totalGross
    totalDeductions
    totalNet
    deductionRate
    deductionsByType { deductionType totalAmount }
  }
}`;
