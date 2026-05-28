'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Log extends Model {
        static associate(models) {
            Log.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
        }
    }
    Log.init({
        userId: { type: DataTypes.INTEGER, allowNull: true },
        username: { type: DataTypes.STRING, allowNull: true },
        role: { type: DataTypes.STRING, defaultValue: 'USER' },
        action: { type: DataTypes.STRING, allowNull: false },
        method: { type: DataTypes.STRING },
        endpoint: { type: DataTypes.STRING },
        details: { type: DataTypes.TEXT },
        ip: { type: DataTypes.STRING },
        suspicious: { type: DataTypes.BOOLEAN, defaultValue: false },
        suspiciousReason: { type: DataTypes.STRING }
    }, {
        sequelize,
        modelName: 'Log',
    });
    return Log;
};