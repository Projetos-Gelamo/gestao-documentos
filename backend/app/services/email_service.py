import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: list[str], subject: str, body_html: str) -> None:
    provider = settings.email_provider.lower()
    try:
        if provider == "resend":
            await _send_resend(to, subject, body_html)
        else:
            _send_smtp(to, subject, body_html)
    except Exception as exc:
        logger.warning("Falha ao enviar e-mail (não bloqueia o sistema): %s", exc)


async def _send_resend(to: list[str], subject: str, body_html: str) -> None:
    import resend

    resend.api_key = settings.email_api_key
    params = resend.Emails.SendParams(
        from_=settings.email_from,
        to=to,
        subject=subject,
        html=body_html,
    )
    resend.Emails.send(params)
    logger.info("E-mail enviado via Resend para: %s", to)


def _send_smtp(to: list[str], subject: str, body_html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.email_from
    msg["To"] = ", ".join(to)
    msg.attach(MIMEText(body_html, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_pass)
        server.sendmail(settings.email_from, to, msg.as_string())
    logger.info("E-mail enviado via SMTP para: %s", to)
