// src/pages/UserManagementPage.jsx
// User Management Page with API integration

import React, { useState, useEffect } from 'react';
import { useAuth, useUserManagement } from '../hooks/useAuth.jsx';

const UserManagementPage = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const {
    users,
    isLoading,
    error,
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    changePassword,
    clearError
  } = useUserManagement();

  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Reset form data
  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: ''
    });
    setShowCreateForm(false);
    setShowPasswordForm(false);
    setSelectedUser(null);
  };

  // Handle create user
  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    const result = await createUser(formData.username, formData.password, true);
    
    if (result.success) {
      alert('Usuario creado exitosamente');
      resetForm();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmNewPassword) {
      alert('Las nuevas contraseñas no coinciden');
      return;
    }

    const result = await changePassword(
      selectedUser.username,
      formData.currentPassword,
      formData.newPassword
    );
    
    if (result.success) {
      alert('Contraseña cambiada exitosamente');
      resetForm();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  // Handle toggle user status
  const handleToggleStatus = async (username) => {
    if (window.confirm(`¿Está seguro de cambiar el estado del usuario ${username}?`)) {
      const result = await toggleUserStatus(username);
      
      if (result.success) {
        alert('Estado del usuario actualizado');
      } else {
        alert(`Error: ${result.error}`);
      }
    }
  };

  // Handle delete user
  const handleDeleteUser = async (username) => {
    if (window.confirm(`¿Está seguro de eliminar el usuario ${username}? Esta acción no se puede deshacer.`)) {
      const result = await deleteUser(username);
      
      if (result.success) {
        alert('Usuario eliminado exitosamente');
      } else {
        alert(`Error: ${result.error}`);
      }
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p><strong>Acceso Denegado:</strong> Solo los administradores pueden acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Usuarios</h1>
        <p className="text-gray-600">Administrar usuarios del sistema</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
          <button 
            onClick={clearError}
            className="text-red-800 underline text-sm mt-1"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Crear Usuario
        </button>
        <button
          onClick={loadUsers}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          Recargar Lista
        </button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="mb-6 bg-gray-50 p-6 rounded-lg border">
          <h2 className="text-xl font-bold mb-4">Crear Nuevo Usuario</h2>
          <form onSubmit={handleCreateUser}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de Usuario
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Contraseña
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Crear Usuario
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password Change Form */}
      {showPasswordForm && selectedUser && (
        <div className="mb-6 bg-gray-50 p-6 rounded-lg border">
          <h2 className="text-xl font-bold mb-4">Cambiar Contraseña - {selectedUser.username}</h2>
          <form onSubmit={handlePasswordChange}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  name="confirmNewPassword"
                  value={formData.confirmNewPassword}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Cambiar Contraseña
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Lista de Usuarios</h2>
        </div>
        
        {isLoading ? (
          <div className="p-6 text-center">
            <p>Cargando usuarios...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Último Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Intentos Fallidos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.username} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {user.username}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.is_default ? 'Admin' : 'Usuario'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.last_login 
                        ? new Date(user.last_login).toLocaleString() 
                        : 'Nunca'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.login_attempts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowPasswordForm(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Cambiar Contraseña
                        </button>
                        
                        {user.username !== 'admin' && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(user.username)}
                              className="text-yellow-600 hover:text-yellow-900"
                            >
                              {user.is_active ? 'Deshabilitar' : 'Habilitar'}
                            </button>
                            
                            <button
                              onClick={() => handleDeleteUser(user.username)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Count */}
      <div className="mt-4 text-sm text-gray-600">
        Total de usuarios: {users.length}
      </div>
    </div>
  );
};

export default UserManagementPage;
