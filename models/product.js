'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Product extends Model {
        static associate(models) {
            Product.belongsTo(models.Category, {
                foreignKey: 'categoryId',
                as: 'category'
            });
        }
    }
    Product.init({
        name: DataTypes.STRING,
        price: DataTypes.FLOAT,
        description: DataTypes.TEXT,
        image: DataTypes.STRING,
        categoryId: DataTypes.INTEGER 
    }, {
        sequelize,
        modelName: 'Product',
    });
    return Product;
};