from datetime import datetime

from pydantic import BaseModel


class FeePaymentCreate(BaseModel):
    fee_id: int
    amount: float
    payment_method: str
    transaction_reference: str | None = None
    remarks: str | None = None


class FeePaymentResponse(BaseModel):
    id: int
    fee_id: int
    amount: float
    payment_date: datetime
    payment_method: str
    transaction_reference: str | None
    receipt_number: str
    remarks: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FeeReceiptResponse(BaseModel):
    payment_id: int
    receipt_number: str

    # Student
    student_id: int
    student_name: str
    admission_number: str
    class_name: str | None

    # Fee
    fee_id: int
    fee_title: str
    total_amount: float
    previously_paid: float
    payment_amount: float
    total_paid: float
    remaining_amount: float

    # Payment
    payment_method: str
    transaction_reference: str | None
    payment_date: datetime
    remarks: str | None