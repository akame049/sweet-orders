'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SuspiciousUser extends Model {
        static associate(models) {
            SuspiciousUser.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
        }
    }
    SuspiciousUser.init({
        userId: { type: DataTypes.INTEGER, allowNull: true },
        username: { type: DataTypes.STRING },
        reason: { type: DataTypes.TEXT },
        actionCount: { type: DataTypes.INTEGER, defaultValue: 0 },
        resolved: { type: DataTypes.BOOLEAN, defaultValue: false }
    }, {
        sequelize,
        modelName: 'SuspiciousUser',
    });
    return SuspiciousUser;
};