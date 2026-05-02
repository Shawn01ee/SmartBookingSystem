from __future__ import annotations

import smtplib
from email.message import EmailMessage
from typing import Tuple

from .config import SMTP_FROM, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USERNAME


def send_email(to_email: str, subject: str, body: str) -> Tuple[bool, str]:
    if not SMTP_HOST or not SMTP_FROM:
        print("\n=== EMAIL DEV MODE ===")
        print("To:", to_email)
        print("Subject:", subject)
        print(body)
        print("=== END EMAIL ===\n")
        return True, "DEV_MODE_PRINTED"

    message = EmailMessage()
    message["From"] = SMTP_FROM
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as client:
            client.starttls()
            if SMTP_USERNAME:
                client.login(SMTP_USERNAME, SMTP_PASSWORD)
            client.send_message(message)
        return True, "OK"
    except Exception as exc:  # pragma: no cover - depends on SMTP environment
        return False, repr(exc)
