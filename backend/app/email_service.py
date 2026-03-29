import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import dns.resolver # Требуется установка: pip install dnspython

# ВАЖНО: Храните данные в переменных окружения, а не в коде!
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


def check_email_domain(email):
    """Проверяет, может ли домен принимать почту"""
    try:
        domain = email.split('@')[1]
        # Ищем MX записи (Mail Exchange)
        answers = dns.resolver.resolve(domain, 'MX')
        return len(answers) > 0
    except Exception:
        return False



def send_verification_email(to_email, username, token):
    """Отправляет письмо с подтверждением регистрации"""
    
    # Ссылка для подтверждения (ведет на ваш сайт)
    verify_link = f"https://ваш-сайт.ru/api/verify-email?token={token}"
    
    msg = MIMEMultipart()
    msg['From'] = SMTP_USER
    msg['To'] = to_email
    msg['Subject'] = "Подтверждение регистрации"
    
    body = f"""
    Привет, {username}!
    
    Спасибо за регистрацию. Пожалуйста, подтверди свой email, перейдя по ссылке:
    {verify_link}
    
    Если ты не регистрировался, просто игнорируй это письмо.
    """
    
    msg.attach(MIMEText(body, 'plain'))
    
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()  # Шифрование соединения
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Ошибка отправки: {e}")
        return False


