import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import dns.resolver

# ВАЖНО: Храните данные в переменных окружения, а не в коде!
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def check_email_domain(email: str) -> bool:
    """
    Проверяет, может ли домен электронной почты принимать письма.
    
    Args:
        email: Email адрес для проверки
        
    Returns:
        True, если у домена есть MX-записи (может принимать почту)
        False, если домен не существует или не настроен для почты
    """
    try:
        # Извлекаем домен из email
        domain = email.split('@')[1].lower().strip()
        
        # Проверяем, что домен не пустой
        if not domain:
            return False
            
        # Ищем MX-записи (Mail Exchange) — они отвечают за приём почты
        answers = dns.resolver.resolve(domain, 'MX')
        
        # Если есть хотя бы одна запись — домен может принимать почту
        return len(answers) > 0
        
    except dns.resolver.NXDOMAIN:
        # Домен не существует
        return False
    except dns.resolver.NoAnswer:
        # Домен есть, но нет MX-записей (почта не настроена)
        return False
    except dns.resolver.NoNameservers:
        # Не удалось связаться с DNS-серверами (проблема сети)
        return False
    except IndexError:
        # В email нет '@' или домена (некорректный формат)
        return False
    except Exception:
        # Любая другая ошибка — считаем, что домен не проверен
        return False

def is_valid_email_format(email: str) -> bool:
    """
    Простая проверка формата email (есть @, домен, точка).
    Не проверяет существование, только синтаксис.
    """
    import re
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    return re.match(pattern, email) is not None

def send_verification_email(to_email: str, username: str, token: str) -> bool:
    """Отправляет письмо с подтверждением регистрации"""
    
    verify_link = f"{FRONTEND_URL}/verify-email?token={token}"
    
    # Создаём сообщение с явной кодировкой UTF-8
    msg = MIMEMultipart('alternative', _charset='utf-8')
    msg['From'] = str(SMTP_USER)
    msg['To'] = str(to_email)
    msg['Subject'] = str("Подтверждение регистрации — Трампин")
    
    # Тело письма в кодировке UTF-8
    body = f"""
    Привет, {username}!
    
    Спасибо за регистрацию на платформе "Трамплин".
    
    Пожалуйста, подтверди свой email, перейдя по ссылке:
    {verify_link}
    
    Если ты не регистрировался, просто игнорируй это письмо.
    
    — Команда Трампин
    """.strip()
    
    # Добавляем текст с явной кодировкой
    msg.attach(MIMEText(body, 'plain', 'utf-8'))
    
    try:
        print(f"\n[SMTP] Попытка отправки:")
        print(f"   To: {to_email}")
        print(f"   Server: {SMTP_SERVER}:{SMTP_PORT}")
        print(f"   From: {SMTP_USER}")
        
        # Подключение
        if SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=10)
        else:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10)
            server.starttls()
        
        server.login(SMTP_USER, SMTP_PASSWORD)
        print("   Авторизация успешна")
        
        # Отправка с кодировкой
        server.send_message(msg, from_addr=SMTP_USER, to_addrs=[to_email])
        print("   Письмо отправлено")
        
        server.quit()
        return True
        
    except UnicodeEncodeError as e:
        print(f"\n[SMTP] Ошибка кодировки: {e}")
        print("   Убедитесь, что все строки в письме — UTF-8")
        return False
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"\n[SMTP] Ошибка авторизации: {e}")
        return False
        
    except Exception as e:
        print(f"\n[SMTP] Ошибка: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False
