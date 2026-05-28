'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Permission extends Model {
        static associate(models) {
            Permission.belongsToMany(models.Role, {
                through: 'RolePermissions',
                foreignKey: 'permissionId',
                as: 'roles'
            });
        }
    }

    Permission.init({
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        description: {
            type: DataTypes.STRING,
        }
    }, {
        sequelize,
        modelName: 'Permission',
    });

    return Permission;
};