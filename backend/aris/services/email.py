from typing import Optional

import resend
from pydantic import BaseModel

from ..config import settings
from ..logging_config import get_logger


logger = get_logger(__name__)


class EmailConfig(BaseModel):
    resend_api_key: str
    from_email: str = "noreply@aris.pub"
    admin_email: Optional[str] = None


class EmailService:
    def __init__(self, config: EmailConfig):
        self.config = config
        resend.api_key = config.resend_api_key
    
    async def send_waitlist_confirmation(
        self,
        to_email: str,
        unsubscribe_token: str
    ) -> bool:
        """Send RSM Studio early access confirmation email."""
        logger.info(f"Attempting to send RSM Studio confirmation email to {to_email}")
        try:
            html_content = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>You're on the RSM Studio early access list!</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #027AC7; margin: 0;">You're in 🎉</h1>
                    <p style="color: #6b7280; margin: 5px 0 0 0;">RSM Studio Early Access</p>
                </div>
                
                <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 30px; border-left: 4px solid #027AC7;">
                    <h2 style="margin-top: 0; color: #1f2937;">Hi 👋</h2>
                    <p style="font-size: 18px; color: #027AC7; margin: 0 0 20px 0;"><strong>Welcome to the RSM Studio early access list.</strong></p>

                    <p>We're thrilled you're interested in the future of scholarly writing. RSM Studio is designed specifically for <strong>Readable Science Markup (RSM)</strong> - a markup language built for pixels, not paper.</p>

                    <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 25px 0; border: 1px solid #e5e7eb;">
                        <h3 style="margin-top: 0; color: #1f2937; font-size: 16px;">What to expect:</h3>
                        <ul style="margin: 15px 0; padding-left: 20px;">
                            <li style="margin-bottom: 8px;"><strong>Launch timeline:</strong> mid 2026</li>
                            <li style="margin-bottom: 8px;"><strong>Early access:</strong> You'll be among the first to try RSM Studio</li>
                            <li style="margin-bottom: 8px;"><strong>Updates:</strong> We'll email you when we're ready (not before)</li>
                            <li style="margin-bottom: 8px;"><strong>Your input:</strong> Help shape the tool with your feedback</li>
                        </ul>
                    </div>

                    <p>No spam, no endless updates - just one email when RSM Studio is ready for you to explore.</p>
                </div>
                
                <div style="text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                    <p>Questions about RSM Studio? Just reply to this email!</p>
                    <p style="margin-top: 15px; font-size: 12px;">
                        RSM Studio is part of <a href="https://aris.pub" style="color: #027AC7; text-decoration: none;">The Aris Program</a> - Academic publishing for the post‑PDF era.
                    </p>
                </div>
            </body>
            </html>
            """
            
            text_content = """
            You're in 🎉
            RSM Studio Early Access

            Hi 👋

            Welcome to the RSM Studio early access list.

            We're thrilled you're interested in the future of scholarly writing. RSM Studio is designed specifically for Readable Science Markup (RSM) - a markup language built for pixels, not paper.

            What to expect:
            • Launch timeline: mid 2026
            • Early access: You'll be among the first to try RSM Studio
            • Updates: We'll email you when we're ready (not before)
            • Your input: Help shape the tool with your feedback

            No spam, no endless updates - just one email when RSM Studio is ready for you to explore.

            Questions about RSM Studio? Just reply to this email!

            RSM Studio is part of The Aris Program (https://aris.pub) - Academic publishing for the post‑PDF era.
            """
            
            params = {
                "from": f"RSM Studio <{self.config.from_email}>",
                "to": [to_email],
                "reply_to": "hello@aris.pub",
                "subject": "You're on the RSM Studio early access list! 🎉",
                "html": html_content,
                "text": text_content,
            }
            
            resend.Emails.send(params)  # type: ignore
            logger.info(f"Successfully sent confirmation email to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    async def send_verification_email(
        self,
        to_email: str,
        name: str,
        token: str,
        frontend_url: str,
    ) -> bool:
        """Send email verification link to a newly registered user."""
        verification_link = f"{frontend_url}/verify-email/{token}"
        logger.info(f"Sending verification email to {to_email}")
        try:
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Confirm your email — RSM Studio</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #027AC7; margin: 0;">RSM Studio</h1>
                </div>

                <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 30px; border-left: 4px solid #027AC7;">
                    <p style="font-size: 16px; margin: 0 0 20px 0;">Hi {name},</p>
                    <p style="font-size: 16px; margin: 0 0 24px 0;">You registered for RSM Studio. Click below to confirm your email and you're done.</p>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{verification_link}" style="background: #027AC7; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Confirm my email</a>
                    </div>

                    <p style="font-size: 13px; color: #6b7280; margin: 20px 0 0 0;">
                        Or copy and paste this link:<br>
                        <a href="{verification_link}" style="color: #027AC7; word-break: break-all;">{verification_link}</a>
                    </p>
                </div>

                <div style="text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                    <p>If you didn't create an account, you can safely ignore this email.</p>
                    <p style="font-size: 12px;">
                        <a href="https://aris.pub" style="color: #027AC7; text-decoration: none;">The Aris Program</a> — Academic publishing for the post-PDF era.
                    </p>
                </div>
            </body>
            </html>
            """

            text_content = f"""Hi {name},

You registered for RSM Studio. Confirm your email by visiting the link below.

{verification_link}

If you didn't create an account, you can safely ignore this email.

The Aris Program — https://aris.pub
"""

            params = {
                "from": f"RSM Studio <{self.config.from_email}>",
                "to": [to_email],
                "subject": "Confirm your email — RSM Studio",
                "html": html_content,
                "text": text_content,
            }

            resend.Emails.send(params)  # type: ignore
            logger.info(f"Verification email sent to {to_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send verification email to {to_email}: {str(e)}")
            return False

    async def send_signup_notification(
        self,
        signup_email: str,
        authoring_tools: Optional[list[str]],
        improvements: Optional[str]
    ) -> bool:
        """Send admin notification about new signup."""
        if not self.config.admin_email:
            logger.debug("Admin notifications disabled: ADMIN_EMAIL not configured")
            return False

        logger.info(f"Sending admin notification about signup: {signup_email}")
        try:
            tools_list = ", ".join(authoring_tools) if authoring_tools else "Not specified"
            improvements_text = improvements if improvements else "Not specified"

            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>New RSM Studio Signup</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #027AC7;">New RSM Studio Signup</h2>

                <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p><strong>Email:</strong> {signup_email}</p>
                    <p><strong>Current Tools:</strong> {tools_list}</p>
                    <p><strong>Requested Improvements:</strong><br>{improvements_text}</p>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                    View all signups: <a href="https://aris-backend.fly.dev/docs#/signup" style="color: #027AC7;">Backend API</a>
                </p>
            </body>
            </html>
            """

            text_content = f"""
            New RSM Studio Signup

            Email: {signup_email}
            Current Tools: {tools_list}
            Requested Improvements: {improvements_text}

            View all signups: https://aris-backend.fly.dev/docs#/signup
            """

            params = {
                "from": f"RSM Studio Notifications <{self.config.from_email}>",
                "to": [self.config.admin_email],
                "subject": f"New signup: {signup_email}",
                "html": html_content,
                "text": text_content,
            }

            resend.Emails.send(params)  # type: ignore
            logger.info(f"Successfully sent admin notification about {signup_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send admin notification: {str(e)}")
            return False


    async def send_feedback_notification(
        self,
        user_email: str,
        user_name: str,
        message: str,
    ) -> bool:
        """Send admin notification about user feedback."""
        if not self.config.admin_email:
            logger.debug("Admin notifications disabled: ADMIN_EMAIL not configured")
            return False

        logger.info(f"Sending feedback notification from {user_email}")
        try:
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>New Feedback</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #027AC7;">New Feedback</h2>

                <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p><strong>From:</strong> {user_name} ({user_email})</p>
                    <p><strong>Message:</strong></p>
                    <blockquote style="border-left: 3px solid #027AC7; padding-left: 16px; margin: 12px 0; color: #374151;">{message}</blockquote>
                </div>
            </body>
            </html>
            """

            text_content = f"""New Feedback

From: {user_name} ({user_email})

Message:
{message}
"""

            params = {
                "from": f"RSM Studio Notifications <{self.config.from_email}>",
                "to": [self.config.admin_email],
                "subject": f"Feedback from {user_name}",
                "html": html_content,
                "text": text_content,
            }

            resend.Emails.send(params)  # type: ignore
            logger.info(f"Feedback notification sent for {user_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send feedback notification: {str(e)}")
            return False

    async def send_invitation_email(
        self,
        to_email: str,
        invitee_name: str,
        inviter_name: str,
        file_title: str,
        role: str,
        frontend_url: str,
        file_id: int,
    ) -> bool:
        """Send a collaboration invitation email."""
        from html import escape

        safe_title = escape(file_title)
        file_url = f"{frontend_url}/workspace/{file_id}"
        role_label = "an Editor" if role == "EDITOR" else "a Commenter"
        logger.info(f"Sending invitation email to {to_email} for file {file_id}")

        try:
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>New collaboration — RSM Studio</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #027AC7; margin: 0;">RSM Studio</h1>
                </div>

                <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 30px; border-left: 4px solid #027AC7;">
                    <p style="font-size: 16px; margin: 0 0 20px 0;">Hi {escape(invitee_name)},</p>
                    <p style="font-size: 16px; margin: 0 0 24px 0;">{escape(inviter_name)} added you as {role_label} on the following manuscript:</p>
                    <p style="font-size: 18px; font-weight: 600; margin: 0 0 24px 0; color: #1a1a1a;">{safe_title}</p>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{file_url}" style="background: #027AC7; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Open manuscript</a>
                    </div>

                    <p style="font-size: 13px; color: #6b7280; margin: 20px 0 0 0;">
                        This manuscript is now visible in your Studio home view.
                    </p>
                </div>

                <div style="text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                    <p style="font-size: 12px;">
                        <a href="https://aris.pub" style="color: #027AC7; text-decoration: none;">The Aris Program</a> — Academic publishing for the post-PDF era.
                    </p>
                </div>
            </body>
            </html>
            """

            text_content = f"""Hi {invitee_name},

{inviter_name} added you as {role_label} on the following manuscript:

  {file_title}

You can open it directly:
{file_url}

This manuscript is now visible in your Studio home view.

The Aris Program — https://aris.pub
"""

            params = {
                "from": f"RSM Studio <{self.config.from_email}>",
                "to": [to_email],
                "subject": f"{inviter_name} added you to \"{safe_title}\" — RSM Studio",
                "html": html_content,
                "text": text_content,
            }

            resend.Emails.send(params)  # type: ignore
            logger.info(f"Invitation email sent to {to_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send invitation email to {to_email}: {str(e)}")
            return False


def get_email_service() -> Optional[EmailService]:
    """Get configured email service instance.

    Returns None unless ENV is PROD or STAGING and a real RESEND_API_KEY is set.
    """
    if (
        settings.ENV not in ("PROD", "STAGING")
        or not settings.RESEND_API_KEY
        or settings.RESEND_API_KEY == "your_resend_api_key_here"
    ):
        logger.info("Email service disabled: ENV=%s, key_set=%s", settings.ENV, bool(settings.RESEND_API_KEY))
        return None

    logger.info("Initializing email service with Resend")
    config = EmailConfig(
        resend_api_key=settings.RESEND_API_KEY,
        from_email=settings.FROM_EMAIL,
        admin_email=settings.ADMIN_EMAIL if settings.ADMIN_EMAIL else None
    )

    return EmailService(config)