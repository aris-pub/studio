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
        name: str,
        unsubscribe_token: str
    ) -> bool:
        """Send RSM Studio early access confirmation email."""
        logger.info(f"Attempting to send RSM Studio confirmation email to {to_email}")
        try:
            html_content = f"""
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
                    <h2 style="margin-top: 0; color: #1f2937;">Hi {name} 👋</h2>
                    <p style="font-size: 18px; color: #027AC7; margin: 0 0 20px 0;"><strong>Welcome to the RSM Studio early access list.</strong></p>
                    
                    <p>We're thrilled you're interested in the future of scholarly writing. RSM Studio is designed specifically for <strong>Readable Science Markup (RSM)</strong> - a markup language built for pixels, not paper.</p>
                    
                    <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 25px 0; border: 1px solid #e5e7eb;">
                        <h3 style="margin-top: 0; color: #1f2937; font-size: 16px;">What to expect:</h3>
                        <ul style="margin: 15px 0; padding-left: 20px;">
                            <li style="margin-bottom: 8px;"><strong>Launch timeline:</strong> Late 2025</li>
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
            
            text_content = f"""
            You're in 🎉
            RSM Studio Early Access
            
            Hi {name} 👋
            
            Welcome to the RSM Studio early access list.
            
            We're thrilled you're interested in the future of scholarly writing. RSM Studio is designed specifically for Readable Science Markup (RSM) - a markup language built for pixels, not paper.
            
            What to expect:
            • Launch timeline: Late 2025
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


def get_email_service() -> Optional[EmailService]:
    """Get configured email service instance."""
    if not settings.RESEND_API_KEY or settings.RESEND_API_KEY == "your_resend_api_key_here":
        logger.warning("Email service disabled: RESEND_API_KEY not configured")
        return None

    logger.info("Initializing email service with Resend")
    config = EmailConfig(
        resend_api_key=settings.RESEND_API_KEY,
        from_email=settings.FROM_EMAIL,
        admin_email=settings.ADMIN_EMAIL if settings.ADMIN_EMAIL else None
    )

    return EmailService(config)