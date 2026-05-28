'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Category extends Model {
        static associate(models) {
            Category.hasMany(models.Product, {
                foreignKey: 'categoryId',
                as: 'products'
            });
        }
    }
    Category.init({
        name: {
            type: DataTypes.STRING,
            allowNull: false 
        }
    }, {
        sequelize,
        modelName: 'Category',
    });
    return Category;
};