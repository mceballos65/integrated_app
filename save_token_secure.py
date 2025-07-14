#!/usr/bin/env python3
"""
Script para guardar el token de GitHub de forma segura
Este script te permite guardar tu token de GitHub en el almacenamiento encriptado
sin que aparezca nunca en plaintext en los archivos de configuración.
"""

from user_encryption import save_github_token, github_token_exists, get_github_token

def main():
    print("=== Guardado Seguro de Token de GitHub ===")
    print()
    
    # Check if token already exists
    if github_token_exists():
        print("✓ Ya existe un token guardado de forma segura.")
        response = input("¿Quieres reemplazarlo? (y/n): ").lower()
        if response != 'y':
            print("Operación cancelada.")
            return
    
    print("Por favor, ingresa tu token de GitHub:")
    print("IMPORTANTE: El token será encriptado y guardado de forma segura.")
    print("Nunca aparecerá en plaintext en los archivos de configuración.")
    print()
    
    # Get token from user (hidden input would be better, but this works)
    token = input("Token de GitHub: ").strip()
    
    if not token:
        print("Token vacío. Operación cancelada.")
        return
    
    if not token.startswith('ghp_'):
        print("ADVERTENCIA: El token no parece ser un token de GitHub válido (no empieza con 'ghp_')")
        response = input("¿Continuar de todas formas? (y/n): ").lower()
        if response != 'y':
            print("Operación cancelada.")
            return
    
    # Save token securely
    success = save_github_token(token)
    
    if success:
        print()
        print("✓ Token guardado de forma segura!")
        print("✓ El token está encriptado y no aparecerá en plaintext en app_config.json")
        print("✓ Ahora puedes usar el frontend para configurar GitHub sin preocuparte por la seguridad")
        print()
        print("IMPORTANTE: Nunca hagas commit del token en plaintext en ningún archivo.")
    else:
        print("✗ Error al guardar el token. Revisa los logs para más detalles.")

if __name__ == "__main__":
    main()
