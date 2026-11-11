export const financeMigration = `
CREATE TABLE IF NOT EXISTS finance_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 barbershop_id uuid NOT NULL REFERENCES barbershops(id),
 created_by uuid NOT NULL REFERENCES users(id),
 request_id uuid NOT NULL,
 request_hash text NOT NULL,
 kind text NOT NULL,
 category text NOT NULL,
 description text NOT NULL CHECK (char_length(description) BETWEEN 2 AND 160),
 amount_in_cents integer NOT NULL,
 due_on date NOT NULL,
 paid_on date,
 payee text NOT NULL DEFAULT '',
 status text NOT NULL CHECK (status IN ('PLANNED','PAID','CANCELLED')),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 booking_id uuid REFERENCES bookings(id),
 source_id uuid REFERENCES finance_entries(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT finance_entries_amount_check CHECK (amount_in_cents > 0),
 CONSTRAINT finance_entries_request_unique UNIQUE (barbershop_id,request_id),
 CONSTRAINT finance_entries_copy_unique UNIQUE (barbershop_id,source_id,due_on),
 CONSTRAINT finance_entries_payment_check CHECK ((status='PAID') = (paid_on IS NOT NULL)),
 CONSTRAINT finance_entries_kind_check CHECK (
   (kind='EXPENSE' AND booking_id IS NULL AND category IN ('FIXED','VARIABLE','BARBER_PAYOUT','PAYROLL','OTHER'))
   OR (kind='RECEIPT' AND booking_id IS NOT NULL AND category='BOOKING' AND status='PAID')
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS finance_entries_booking_unique ON finance_entries(booking_id) WHERE kind='RECEIPT';
CREATE INDEX IF NOT EXISTS finance_entries_due_idx ON finance_entries(barbershop_id,due_on);
CREATE INDEX IF NOT EXISTS finance_entries_paid_idx ON finance_entries(barbershop_id,paid_on);
`;
