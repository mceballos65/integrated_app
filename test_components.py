"""
Test script para verificar los endpoints de componentes
"""
import requests
import json

# URL base del backend (ajusta según tu configuración)
BASE_URL = "http://localhost:8000"

def test_components_endpoints():
    print("🧪 Probando endpoints de componentes...")
    
    try:
        # 1. Obtener componentes
        print("\n1. Obteniendo lista de componentes...")
        response = requests.get(f"{BASE_URL}/api/components")
        if response.status_code == 200:
            components = response.json()
            print(f"✅ Componentes obtenidos: {len(components.get('components', []))} componentes")
            print(json.dumps(components, indent=2))
        else:
            print(f"❌ Error al obtener componentes: {response.status_code}")
            
        # 2. Obtener solo componentes habilitados
        print("\n2. Obteniendo componentes habilitados...")
        response = requests.get(f"{BASE_URL}/api/components/enabled")
        if response.status_code == 200:
            enabled_components = response.json()
            print(f"✅ Componentes habilitados: {len(enabled_components.get('components', []))} componentes")
        else:
            print(f"❌ Error al obtener componentes habilitados: {response.status_code}")
            
        # 3. Crear un componente de prueba
        print("\n3. Creando componente de prueba...")
        test_component = {
            "name": "Test Component",
            "value": "test-component",
            "description": "Un componente de prueba",
            "enabled": True
        }
        
        response = requests.post(f"{BASE_URL}/api/components", json=test_component)
        if response.status_code == 200:
            created_component = response.json()
            print(f"✅ Componente creado: {created_component['name']}")
            component_id = created_component['id']
            
            # 4. Actualizar el componente
            print("\n4. Actualizando componente...")
            update_data = {"description": "Descripción actualizada"}
            response = requests.put(f"{BASE_URL}/api/components/{component_id}", json=update_data)
            if response.status_code == 200:
                print("✅ Componente actualizado correctamente")
            else:
                print(f"❌ Error al actualizar componente: {response.status_code}")
            
            # 5. Alternar estado del componente
            print("\n5. Alternando estado del componente...")
            response = requests.post(f"{BASE_URL}/api/components/{component_id}/toggle")
            if response.status_code == 200:
                print("✅ Estado del componente alternado correctamente")
            else:
                print(f"❌ Error al alternar estado: {response.status_code}")
            
            # 6. Eliminar el componente de prueba
            print("\n6. Eliminando componente de prueba...")
            response = requests.delete(f"{BASE_URL}/api/components/{component_id}")
            if response.status_code == 200:
                print("✅ Componente eliminado correctamente")
            else:
                print(f"❌ Error al eliminar componente: {response.status_code}")
                
        else:
            print(f"❌ Error al crear componente: {response.status_code}")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("❌ No se puede conectar al servidor. Asegúrate de que el backend esté ejecutándose en el puerto 8000")
    except Exception as e:
        print(f"❌ Error inesperado: {e}")

if __name__ == "__main__":
    test_components_endpoints()
